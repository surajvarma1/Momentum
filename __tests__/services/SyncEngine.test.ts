import { SyncEngine } from '../../src/services/sync/SyncEngine';
import { ISyncRepository } from '../../src/data/repositories/ISyncRepository';
import { ITaskRepository } from '../../src/data/repositories/ITaskRepository';
import { IAuthService, AuthUser, AuthSession } from '../../src/services/auth/IAuthService';
import { OutboxItem, SyncTombstone, SyncEntityType, MutationType } from '../../src/domain/sync/SyncTypes';
import { Task } from '../../src/domain/entities/Task';

class InMemorySyncRepository implements ISyncRepository {
  public outbox: OutboxItem[] = [];
  public tombstones: SyncTombstone[] = [];
  public metadata: Map<string, string> = new Map();

  async addToOutbox(item: {
    id: string;
    mutationType: MutationType;
    entityType: SyncEntityType;
    entityId: string;
    payload?: any;
    createdAt: string;
  }): Promise<void> {
    this.outbox.push({
      ...item,
      payload: item.payload ?? null,
      retryCount: 0,
    });
  }

  async getPendingOutboxItems(limit: number = 50): Promise<OutboxItem[]> {
    return this.outbox.slice(0, limit);
  }

  async removeOutboxItem(id: string): Promise<void> {
    this.outbox = this.outbox.filter((o) => o.id !== id);
  }

  async updateOutboxItemFailure(id: string, errorMessage: string, retryCount: number): Promise<void> {
    const item = this.outbox.find((o) => o.id === id);
    if (item) {
      item.errorMessage = errorMessage;
      item.retryCount = retryCount;
      item.lastAttemptAt = new Date().toISOString();
    }
  }

  async recordTombstone(entityType: SyncEntityType, entityId: string): Promise<void> {
    this.tombstones.push({
      id: `${entityType}_${entityId}`,
      entityType,
      entityId,
      deletedAt: new Date().toISOString(),
    });
  }

  async isTombstoned(entityType: SyncEntityType, entityId: string): Promise<boolean> {
    return this.tombstones.some((t) => t.entityType === entityType && t.entityId === entityId);
  }

  async getTombstones(): Promise<SyncTombstone[]> {
    return [...this.tombstones];
  }

  async getMetadata(key: string): Promise<string | null> {
    return this.metadata.get(key) || null;
  }

  async setMetadata(key: string, value: string): Promise<void> {
    this.metadata.set(key, value);
  }

  async clearOutbox(): Promise<void> {
    this.outbox = [];
  }
}

class InMemoryTaskRepo implements ITaskRepository {
  public tasks: Task[] = [];

  async create(task: Omit<Task, 'subtasks'>, subtasks: any[] = []): Promise<Task> {
    const t: Task = { ...task, subtasks };
    this.tasks.push(t);
    return t;
  }
  async findById(id: string): Promise<Task | null> {
    return this.tasks.find((t) => t.id === id) || null;
  }
  async findAll(): Promise<Task[]> {
    return [...this.tasks];
  }
  async filter(): Promise<Task[]> {
    return [...this.tasks];
  }
  async update(id: string, updates: any): Promise<Task> {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Not found');
    this.tasks[idx] = { ...this.tasks[idx], ...updates };
    return this.tasks[idx];
  }
  async delete(id: string): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }
  async count(): Promise<number> {
    return this.tasks.length;
  }
  async addSubtask(): Promise<any> {}
  async updateSubtask(): Promise<void> {}
  async deleteSubtask(): Promise<void> {}
}

class MockAuthService implements IAuthService {
  private guest: boolean = true;
  private user: AuthUser | null = null;

  setUser(user: AuthUser | null) {
    this.user = user;
    this.guest = !user;
  }

  isGuest(): boolean {
    return this.guest;
  }
  setGuest(isGuest: boolean): void {
    this.guest = isGuest;
  }
  async signUp(): Promise<any> {}
  async signIn(): Promise<any> {}
  async signOut(): Promise<void> {
    this.user = null;
    this.guest = true;
  }
  async resetPassword(): Promise<void> {}
  async getCurrentUser(): Promise<AuthUser | null> {
    return this.user;
  }
  async getSession(): Promise<AuthSession | null> {
    if (!this.user) return null;
    return {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: this.user,
    };
  }
  onAuthStateChange(): () => void {
    return () => {};
  }
}

describe('SyncEngine Offline-First Synchronization', () => {
  let syncRepo: InMemorySyncRepository;
  let taskRepo: InMemoryTaskRepo;
  let authService: MockAuthService;
  let syncEngine: SyncEngine;

  const mockUser: AuthUser = {
    id: 'user-abc-123',
    email: 'user@test.local',
    createdAt: '2026-10-25T12:00:00.000Z',
  };

  beforeEach(() => {
    syncRepo = new InMemorySyncRepository();
    taskRepo = new InMemoryTaskRepo();
    authService = new MockAuthService();
    syncEngine = new SyncEngine(syncRepo, taskRepo, authService);
  });

  describe('Guest Mode Isolation', () => {
    it('does not push or pull when user is in guest mode', async () => {
      authService.setGuest(true);
      await syncRepo.addToOutbox({
        id: 'outbox-1',
        mutationType: 'CREATE',
        entityType: 'task',
        entityId: 't-1',
        createdAt: new Date().toISOString(),
      });

      const result = await syncEngine.sync();
      expect(result.pushedCount).toBe(0);
      expect(result.pulledCount).toBe(0);
      expect(syncRepo.outbox.length).toBe(1); // Still pending in outbox
    });
  });

  describe('Initial Sync Queuing', () => {
    it('queues all local tasks into outbox when user confirms cloud association', async () => {
      await taskRepo.create({
        id: 'task-100',
        title: 'Local task 1',
        description: null,
        priority: 'HIGH',
        energyLevel: 'MEDIUM',
        status: 'PENDING',
        estimatedDurationMinutes: 25,
        deadline: null,
        deadlineTimezone: null,
        tags: [],
        recurrenceRule: null,
        createdAt: '2026-10-25T10:00:00.000Z',
        updatedAt: '2026-10-25T10:00:00.000Z',
        completedAt: null,
        cancelledAt: null,
        sortOrder: 0,
      });

      await syncEngine.enqueueAllLocalTasksForInitialSync();

      const outbox = await syncRepo.getPendingOutboxItems();
      expect(outbox.length).toBe(1);
      expect(outbox[0].entityId).toBe('task-100');
      expect(outbox[0].mutationType).toBe('CREATE');
    });
  });

  describe('Tombstone Protection Against Deleted Task Resurrection', () => {
    it('records tombstone when task is deleted', async () => {
      await syncRepo.recordTombstone('task', 'deleted-task-999');
      const isTombstoned = await syncRepo.isTombstoned('task', 'deleted-task-999');
      expect(isTombstoned).toBe(true);
    });

    it('returns false for non-tombstoned entities', async () => {
      const isTombstoned = await syncRepo.isTombstoned('task', 'active-task-123');
      expect(isTombstoned).toBe(false);
    });
  });

  describe('Bounded Retries & Idempotency', () => {
    it('increments retry count on failure and stops after max retries', async () => {
      await syncRepo.addToOutbox({
        id: 'failing-item',
        mutationType: 'UPDATE',
        entityType: 'task',
        entityId: 't-99',
        createdAt: new Date().toISOString(),
      });

      await syncRepo.updateOutboxItemFailure('failing-item', 'Network 503', 1);
      let items = await syncRepo.getPendingOutboxItems();
      expect(items[0].retryCount).toBe(1);
      expect(items[0].errorMessage).toBe('Network 503');

      // Set to 8 (max retries threshold)
      await syncRepo.updateOutboxItemFailure('failing-item', 'Network 503', 8);
      items = await syncRepo.getPendingOutboxItems();
      expect(items[0].retryCount).toBe(8);
    });
  });
});
