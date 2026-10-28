import { ProposedTask } from '../ai/AIDecomposerTypes';
import { CreateTask } from './CreateTask';
import { Task } from '../entities/Task';

export class ApplyGoalProposal {
  constructor(private createTaskUseCase: CreateTask) {}

  async execute(approvedTasks: ProposedTask[]): Promise<Task[]> {
    const createdTasks: Task[] = [];
    const seenKeys = new Set<string>();

    for (const t of approvedTasks) {
      const dedupKey = `${t.title.trim().toLowerCase()}_${t.suggestedDeadline || ''}`;
      if (seenKeys.has(dedupKey)) {
        continue;
      }
      seenKeys.add(dedupKey);

      const task = await this.createTaskUseCase.execute({
        title: t.title,
        description: t.description || undefined,
        priority: t.priority,
        energyLevel: t.energyLevel,
        estimatedDurationMinutes: t.estimatedDurationMinutes,
        deadline: t.suggestedDeadline || undefined,
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
