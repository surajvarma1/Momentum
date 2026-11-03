import { ProposedTask } from '../ai/AIDecomposerTypes';
import { CreateTask } from './CreateTask';
import { Task } from '../entities/Task';
import { toDateOnlyString, isDeadlineInPast } from '../../utils/dateUtils';

export class ApplyGoalProposal {
  constructor(private createTaskUseCase: CreateTask) {}

  async execute(approvedTasks: ProposedTask[]): Promise<Task[]> {
    const createdTasks: Task[] = [];
    const seenKeys = new Set<string>();

    for (let i = 0; i < approvedTasks.length; i++) {
      const t = approvedTasks[i];
      const dedupKey = `${t.title.trim().toLowerCase()}_${t.suggestedDeadline || ''}`;
      if (seenKeys.has(dedupKey)) {
        continue;
      }
      seenKeys.add(dedupKey);

      let effectiveDeadline: string;
      if (t.suggestedDeadline && !isDeadlineInPast(t.suggestedDeadline)) {
        effectiveDeadline = toDateOnlyString(t.suggestedDeadline);
      } else {
        const forward = new Date();
        forward.setDate(forward.getDate() + i);
        effectiveDeadline = toDateOnlyString(forward);
      }

      const task = await this.createTaskUseCase.execute({
        title: t.title,
        description: t.description || undefined,
        priority: t.priority,
        energyLevel: t.energyLevel,
        estimatedDurationMinutes: t.estimatedDurationMinutes,
        deadline: effectiveDeadline,
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
