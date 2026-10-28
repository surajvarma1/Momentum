import { ITaskRepository, TaskNotFoundError } from './CreateTask';
import { INotificationService } from '../../services/NotificationService';
import { ISyncRepository } from '../../data/repositories/ISyncRepository';

export class DeleteTask {
  constructor(
    private repository: ITaskRepository,
    private notificationService?: INotificationService,
    private syncRepository?: ISyncRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existingTask = await this.repository.findById(id);
    if (!existingTask) {
      throw new TaskNotFoundError(id);
    }

    if (this.notificationService) {
      await this.notificationService.cancelAllForTask(id);
    }

    await this.repository.delete(id);

    if (this.syncRepository) {
      await this.syncRepository.recordTombstone('task', id);
      await this.syncRepository.addToOutbox({
        id: `outbox_del_${id}_${Date.now()}`,
        mutationType: 'DELETE',
        entityType: 'task',
        entityId: id,
        createdAt: new Date().toISOString(),
      });
    }
  }
}
