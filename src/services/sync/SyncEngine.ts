let NetInfo: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-community/netinfo');
  NetInfo = module.default || module;
} catch {
  // Fallback for Node / Jest test environments
}

import { SupabaseClient } from '@supabase/supabase-js';
import { ISyncRepository } from '../../data/repositories/ISyncRepository';
import { ITaskRepository } from '../../data/repositories/ITaskRepository';
import { IAuthService } from '../auth/IAuthService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabaseClient';
import { SyncResult, SyncConflict, OutboxItem } from '../../domain/sync/SyncTypes';
import { Task } from '../../domain/entities/Task';

export class SyncEngine {
  private isSyncing = false;
  private netInfoUnsubscribe: (() => void) | null = null;

  constructor(
    private syncRepo: ISyncRepository,
    private taskRepo: ITaskRepository,
    private authService: IAuthService,
    private supabase: SupabaseClient = getSupabaseClient(),
  ) {}

  public startNetworkMonitoring(): void {
    try {
      if (NetInfo && typeof NetInfo.addEventListener === 'function') {
        this.netInfoUnsubscribe = NetInfo.addEventListener((state: any) => {
          if (state.isConnected && state.isInternetReachable !== false) {
            this.sync().catch(() => {});
          }
        });
      }
    } catch {
      // Graceful fallback for non-native / test environments
    }
  }

  public stopNetworkMonitoring(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
  }

  public async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      pushedCount: 0,
      pulledCount: 0,
      conflicts: [],
      errors: [],
    };

    if (this.isSyncing) {
      return result;
    }

    if (!isSupabaseConfigured() || this.authService.isGuest()) {
      return result;
    }

    const user = await this.authService.getCurrentUser();
    if (!user) {
      return result;
    }

    this.isSyncing = true;

    try {
      // 1. Drain Outbox (Push mutations to cloud)
      await this.drainOutbox(user.id, result);

      // 2. Pull remote changes (Fetch and merge)
      await this.pullRemoteChanges(user.id, result);

      await this.syncRepo.setMetadata('last_synced_at', new Date().toISOString());
    } catch (err: any) {
      result.success = false;
      result.errors.push(err.message || 'Unknown sync error');
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async drainOutbox(userId: string, result: SyncResult): Promise<void> {
    const outboxItems = await this.syncRepo.getPendingOutboxItems(50);
    const now = Date.now();

    for (const item of outboxItems) {
      // Check exponential backoff with jitter
      if (item.retryCount > 0 && item.lastAttemptAt) {
        const lastAttempt = new Date(item.lastAttemptAt).getTime();
        // Bounded exponential backoff: 2^retryCount * 1000ms + random jitter (up to 500ms), max 60s
        const backoffMs = Math.min(60000, Math.pow(2, Math.min(item.retryCount, 6)) * 1000 + Math.random() * 500);
        if (now - lastAttempt < backoffMs) {
          continue; // Not ready for retry yet
        }
      }

      if (item.retryCount >= 8) {
        // Exceeded bounded retry count
        result.errors.push(`Item ${item.entityId} exceeded maximum sync retries`);
        continue;
      }

      try {
        await this.processOutboxItem(userId, item, result);
        await this.syncRepo.removeOutboxItem(item.id);
        result.pushedCount++;
      } catch (err: any) {
        await this.syncRepo.updateOutboxItemFailure(item.id, err.message, item.retryCount + 1);
        result.errors.push(`Failed to push ${item.entityType} ${item.entityId}: ${err.message}`);
      }
    }
  }

  private async processOutboxItem(userId: string, item: OutboxItem, result: SyncResult): Promise<void> {
    if (item.entityType === 'task') {
      if (item.mutationType === 'CREATE' || item.mutationType === 'UPDATE') {
        const task: Task = item.payload;
        // Verify remote record for conflict detection
        const { data: existingRemote } = await this.supabase
          .from('tasks')
          .select('id, updated_at, server_version')
          .eq('id', task.id)
          .single();

        if (existingRemote && existingRemote.updated_at > task.updatedAt) {
          // Conflict: remote is newer
          const conflict: SyncConflict = {
            entityId: task.id,
            entityType: 'task',
            localTimestamp: task.updatedAt,
            remoteTimestamp: existingRemote.updated_at,
            resolution: 'REMOTE_APPLIED',
          };
          result.conflicts.push(conflict);
          return;
        }

        const remoteTask = {
          id: task.id,
          user_id: userId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          energy_level: task.energyLevel,
          status: task.status,
          estimated_duration_minutes: task.estimatedDurationMinutes,
          deadline: task.deadline,
          deadline_timezone: task.deadlineTimezone,
          tags: task.tags,
          recurrence_rule: task.recurrenceRule,
          server_version: ((existingRemote?.server_version || 0) + 1),
          created_at: task.createdAt,
          updated_at: task.updatedAt,
          completed_at: task.completedAt,
          cancelled_at: task.cancelledAt,
          sort_order: task.sortOrder,
        };

        const { error } = await this.supabase.from('tasks').upsert(remoteTask);
        if (error) throw new Error(error.message);
      } else if (item.mutationType === 'DELETE') {
        // Record deletion tombstone remotely and delete
        await this.supabase.from('sync_tombstones').upsert({
          id: `task_${item.entityId}`,
          user_id: userId,
          entity_type: 'task',
          entity_id: item.entityId,
          deleted_at: new Date().toISOString(),
        });
        await this.supabase.from('tasks').delete().eq('id', item.entityId);
      }
    }
  }

  private async pullRemoteChanges(userId: string, result: SyncResult): Promise<void> {
    const lastSyncedAt = await this.syncRepo.getMetadata('last_synced_at');

    // 1. Fetch remote tombstones to ensure local deletions stay deleted
    const tombstoneQuery = this.supabase
      .from('sync_tombstones')
      .select('*')
      .eq('user_id', userId);

    if (lastSyncedAt) {
      tombstoneQuery.gt('deleted_at', lastSyncedAt);
    }

    const { data: remoteTombstones } = await tombstoneQuery;
    if (remoteTombstones && remoteTombstones.length > 0) {
      for (const t of remoteTombstones) {
        await this.syncRepo.recordTombstone(t.entity_type, t.entity_id);
        if (t.entity_type === 'task') {
          await this.taskRepo.delete(t.entity_id);
        }
      }
    }

    // 2. Fetch remote tasks
    const taskQuery = this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (lastSyncedAt) {
      taskQuery.gt('updated_at', lastSyncedAt);
    }

    const { data: remoteTasks, error } = await taskQuery;
    if (error) throw new Error(error.message);

    if (remoteTasks && remoteTasks.length > 0) {
      for (const r of remoteTasks) {
        // Prevent resurrected deleted tasks
        const isDeleted = await this.syncRepo.isTombstoned('task', r.id);
        if (isDeleted) {
          continue;
        }

        const localTask = await this.taskRepo.findById(r.id);
        if (!localTask || r.updated_at >= localTask.updatedAt) {
          const mappedTask: Task = {
            id: r.id,
            title: r.title,
            description: r.description,
            priority: r.priority,
            energyLevel: r.energy_level,
            status: r.status,
            estimatedDurationMinutes: r.estimated_duration_minutes,
            deadline: r.deadline,
            deadlineTimezone: r.deadline_timezone,
            tags: r.tags || [],
            subtasks: [],
            recurrenceRule: r.recurrence_rule,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            completedAt: r.completed_at,
            cancelledAt: r.cancelled_at,
            sortOrder: r.sort_order,
          };

          if (localTask) {
            await this.taskRepo.update(mappedTask.id, mappedTask);
          } else {
            await this.taskRepo.create(mappedTask, []);
          }
          result.pulledCount++;
        }
      }
    }
  }

  public async enqueueAllLocalTasksForInitialSync(): Promise<void> {
    const allTasks = await this.taskRepo.findAll();
    const now = new Date().toISOString();

    for (const task of allTasks) {
      await this.syncRepo.addToOutbox({
        id: `outbox_${task.id}_${Date.now()}`,
        mutationType: 'CREATE',
        entityType: 'task',
        entityId: task.id,
        payload: task,
        createdAt: now,
      });
    }
  }
}
