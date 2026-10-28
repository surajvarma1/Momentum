import { Task, TaskFilter } from '../entities/Task';
import { ITaskRepository, IClock } from './CreateTask';

export class FilterTasks {
  constructor(
    private repository: ITaskRepository,
    private clock: IClock,
  ) {}

  async execute(filter: TaskFilter): Promise<Task[]> {
    const now = this.clock.now();
    return this.repository.filter(filter, now);
  }
}
