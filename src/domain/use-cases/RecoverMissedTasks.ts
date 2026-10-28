/**
 * Recover Missed Tasks Use Case.
 * Identifies overdue incomplete tasks, generates realistic reschedule proposals,
 * and records user decisions with optional deferral reasons.
 */

import { ITaskRepository } from '../../data/repositories/ITaskRepository';
import { IMissedTaskRepository } from '../../data/repositories/IMissedTaskRepository';
import { IIdGenerator } from '../../services/IdGenerator';
import { IClock } from '../../services/ClockService';
import {
  MissedTaskRecoveryEngine,
  RecoverySuggestion,
  MissedTaskRecord,
} from '../accountability/MissedTaskRecovery';
import { UpdateTask } from './UpdateTask';

export class RecoverMissedTasks {
  constructor(
    private taskRepo: ITaskRepository,
    private missedTaskRepo: IMissedTaskRepository,
    private updateTask: UpdateTask,
    private idGenerator: IIdGenerator,
    private clock: IClock,
  ) {}

  /**
   * Evaluates all tasks and returns pending recovery suggestions.
   */
  async evaluatePendingRecoveries(requireDeferralReasons: boolean = false): Promise<RecoverySuggestion[]> {
    const now = this.clock.now();
    const overdueTasks = await this.taskRepo.filter({ isOverdue: true }, now);
    const suggestions: RecoverySuggestion[] = [];

    for (const task of overdueTasks) {
      const records = await this.missedTaskRepo.findByTaskId(task.id);
      const evalResult = MissedTaskRecoveryEngine.evaluateMissedTask(
        task,
        now,
        records,
        requireDeferralReasons,
      );
      if (evalResult) {
        suggestions.push(evalResult);
      }
    }

    return suggestions;
  }

  /**
   * Accepts suggested reschedule or custom deadline.
   */
  async applyRecovery(
    taskId: string,
    newDeadline: string,
    action: 'ACCEPTED' | 'RESCHEDULED' | 'DISMISSED',
    deferralReason?: string | null,
  ): Promise<MissedTaskRecord> {
    const now = this.clock.now();

    if (action === 'ACCEPTED' || action === 'RESCHEDULED') {
      await this.updateTask.execute(taskId, {
        deadline: newDeadline,
      });
    }

    const id = this.idGenerator.generate();
    const created = await this.missedTaskRepo.create({
      id,
      taskId,
      detectedAt: now,
      suggestedDeadline: newDeadline,
      createdAt: now,
    });

    return this.missedTaskRepo.resolve(id, action, now, deferralReason);
  }
}
