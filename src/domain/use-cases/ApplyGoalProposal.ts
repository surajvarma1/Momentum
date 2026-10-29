import { ProposedTask } from '../ai/AIDecomposerTypes';
import { CreateTask } from './CreateTask';
import { Task } from '../entities/Task';

export class ApplyGoalProposal {
  constructor(private createTaskUseCase: CreateTask) {}

  async execute(approvedTasks: ProposedTask[]): Promise<Task[]> {
    const createdTasks: Task[] = [];
    const seenKeys = new Set<string>();
    const nowTs = Date.now();
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < approvedTasks.length; i++) {
      const t = approvedTasks[i];
      const dedupKey = `${t.title.trim().toLowerCase()}_${t.suggestedDeadline || ''}`;
      if (seenKeys.has(dedupKey)) {
        continue;
      }
      seenKeys.add(dedupKey);

      let effectiveDeadline = t.suggestedDeadline;
      if (effectiveDeadline) {
        const parsed = Date.parse(effectiveDeadline);
        // If deadline is invalid, from past year, or in the past, calibrate to day i
        if (isNaN(parsed) || new Date(parsed).getFullYear() < currentYear || parsed <= nowTs - 86400000) {
          const forward = new Date();
          forward.setDate(forward.getDate() + i);
          forward.setHours(23, 59, 59, 0);
          effectiveDeadline = forward.toISOString();
        }
      } else {
        const forward = new Date();
        forward.setDate(forward.getDate() + i);
        forward.setHours(23, 59, 59, 0);
        effectiveDeadline = forward.toISOString();
      }

      // Guarantee deadline is in the future for validation rules
      if (effectiveDeadline && Date.parse(effectiveDeadline) <= nowTs) {
        const bumped = new Date(nowTs + 3600000);
        effectiveDeadline = bumped.toISOString();
      }

      const task = await this.createTaskUseCase.execute({
        title: t.title,
        description: t.description || undefined,
        priority: t.priority,
        energyLevel: t.energyLevel,
        estimatedDurationMinutes: t.estimatedDurationMinutes,
        deadline: effectiveDeadline || undefined,
        subtasks: (t.subtasks || []).map((stTitle, idx) => ({
          title: stTitle,
          sortOrder: idx,
        })),
      });

      createdTasks.push(task);
    }

    return createdTasks;
  }
}
