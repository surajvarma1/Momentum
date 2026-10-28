import { Task } from '../entities/Task';
import { ITaskRepository } from './CreateTask';

export class ListTasks {
  constructor(private repository: ITaskRepository) {}

  async execute(): Promise<Task[]> {
    const tasks = await this.repository.findAll();
    return tasks.slice().sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      // Descending by createdAt
      return b.createdAt.localeCompare(a.createdAt);
    });
  }
}
