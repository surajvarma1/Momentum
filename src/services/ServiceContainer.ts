/**
 * Dependency injection container.
 * Provides singleton instances of services, repositories, and use cases.
 */

import { IClock, SystemClock } from './ClockService';
import { IIdGenerator, UUIDGenerator } from './IdGenerator';
import { INotificationService, NotificationService } from './NotificationService';
import { ITaskRepository } from '../data/repositories/ITaskRepository';
import { IReminderRepository } from '../data/repositories/IReminderRepository';
import { IFocusSessionRepository } from '../data/repositories/IFocusSessionRepository';
import { IMissedTaskRepository } from '../data/repositories/IMissedTaskRepository';
import { ISyncRepository } from '../data/repositories/ISyncRepository';
import { IAuthService } from './auth/IAuthService';
import { SupabaseAuthService } from './auth/SupabaseAuthService';
import { SyncEngine } from './sync/SyncEngine';
import { IAIDecomposerService } from '../domain/ai/IAIDecomposerService';
import { SupabaseAIDecomposerService } from './ai/SupabaseAIDecomposerService';

import { CreateTask } from '../domain/use-cases/CreateTask';
import { UpdateTask } from '../domain/use-cases/UpdateTask';
import { CompleteTask } from '../domain/use-cases/CompleteTask';
import { ReopenTask } from '../domain/use-cases/ReopenTask';
import { CancelTask } from '../domain/use-cases/CancelTask';
import { DeleteTask } from '../domain/use-cases/DeleteTask';
import { ListTasks } from '../domain/use-cases/ListTasks';
import { FilterTasks } from '../domain/use-cases/FilterTasks';
import { CreateReminder } from '../domain/use-cases/CreateReminder';
import { CancelReminder } from '../domain/use-cases/CancelReminder';
import { SnoozeReminder } from '../domain/use-cases/SnoozeReminder';
import { ManageFocusSession } from '../domain/use-cases/ManageFocusSession';
import { RecoverMissedTasks } from '../domain/use-cases/RecoverMissedTasks';
import { DecomposeGoal } from '../domain/use-cases/DecomposeGoal';
import { ApplyGoalProposal } from '../domain/use-cases/ApplyGoalProposal';

export interface ServiceContainerConfig {
  taskRepository: ITaskRepository;
  reminderRepository?: IReminderRepository;
  focusSessionRepository?: IFocusSessionRepository;
  missedTaskRepository?: IMissedTaskRepository;
  syncRepository?: ISyncRepository;
  notificationService?: INotificationService;
  authService?: IAuthService;
  syncEngine?: SyncEngine;
  aiDecomposerService?: IAIDecomposerService;
  clock?: IClock;
  idGenerator?: IIdGenerator;
}

export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  readonly clock: IClock;
  readonly idGenerator: IIdGenerator;
  readonly notificationService: INotificationService;
  readonly taskRepository: ITaskRepository;
  readonly reminderRepository?: IReminderRepository;
  readonly focusSessionRepository?: IFocusSessionRepository;
  readonly missedTaskRepository?: IMissedTaskRepository;
  readonly syncRepository?: ISyncRepository;
  readonly authService: IAuthService;
  readonly syncEngine?: SyncEngine;
  readonly aiDecomposerService: IAIDecomposerService;

  // Phase 1 Use Cases
  readonly createTask: CreateTask;
  readonly updateTask: UpdateTask;
  readonly completeTask: CompleteTask;
  readonly reopenTask: ReopenTask;
  readonly cancelTask: CancelTask;
  readonly deleteTask: DeleteTask;
  readonly listTasks: ListTasks;
  readonly filterTasks: FilterTasks;

  // Phase 2 Use Cases
  readonly createReminder?: CreateReminder;
  readonly cancelReminder?: CancelReminder;
  readonly snoozeReminder?: SnoozeReminder;
  readonly manageFocusSession?: ManageFocusSession;
  readonly recoverMissedTasks?: RecoverMissedTasks;

  // Phase 3 Use Cases
  readonly decomposeGoal: DecomposeGoal;
  readonly applyGoalProposal: ApplyGoalProposal;

  constructor(config: ServiceContainerConfig) {
    this.clock = config.clock ?? new SystemClock();
    this.idGenerator = config.idGenerator ?? new UUIDGenerator();
    this.notificationService = config.notificationService ?? new NotificationService();
    this.taskRepository = config.taskRepository;
    this.reminderRepository = config.reminderRepository;
    this.focusSessionRepository = config.focusSessionRepository;
    this.missedTaskRepository = config.missedTaskRepository;
    this.syncRepository = config.syncRepository;
    this.authService = config.authService ?? new SupabaseAuthService();
    this.aiDecomposerService = config.aiDecomposerService ?? new SupabaseAIDecomposerService();

    // Initialize Phase 1 use cases with Phase 2 notification and Phase 3 sync outbox capabilities
    this.createTask = new CreateTask(
      this.taskRepository,
      this.idGenerator,
      this.clock,
      this.syncRepository,
    );
    this.updateTask = new UpdateTask(this.taskRepository, this.clock, this.syncRepository);
    this.completeTask = new CompleteTask(
      this.taskRepository,
      this.clock,
      this.reminderRepository,
      this.notificationService,
      this.syncRepository,
    );
    this.reopenTask = new ReopenTask(this.taskRepository, this.clock);
    this.cancelTask = new CancelTask(
      this.taskRepository,
      this.clock,
      this.reminderRepository,
      this.notificationService,
      this.syncRepository,
    );
    this.deleteTask = new DeleteTask(
      this.taskRepository,
      this.notificationService,
      this.syncRepository,
    );
    this.listTasks = new ListTasks(this.taskRepository);
    this.filterTasks = new FilterTasks(this.taskRepository, this.clock);

    // Initialize Phase 2 use cases
    if (this.reminderRepository) {
      this.createReminder = new CreateReminder(
        this.reminderRepository,
        this.taskRepository,
        this.notificationService,
        this.idGenerator,
        this.clock,
      );
      this.cancelReminder = new CancelReminder(
        this.reminderRepository,
        this.notificationService,
        this.clock,
      );
      this.snoozeReminder = new SnoozeReminder(
        this.reminderRepository,
        this.taskRepository,
        this.notificationService,
        this.clock,
      );
    }

    if (this.focusSessionRepository) {
      this.manageFocusSession = new ManageFocusSession(
        this.focusSessionRepository,
        this.idGenerator,
        this.clock,
      );
    }

    if (this.missedTaskRepository) {
      this.recoverMissedTasks = new RecoverMissedTasks(
        this.taskRepository,
        this.missedTaskRepository,
        this.updateTask,
        this.idGenerator,
        this.clock,
      );
    }

    // Initialize Phase 3 Sync Engine if syncRepository is provided
    if (this.syncRepository) {
      this.syncEngine =
        config.syncEngine ??
        new SyncEngine(this.syncRepository, this.taskRepository, this.authService);
      this.syncEngine.startNetworkMonitoring();
    }

    // Initialize Phase 3 AI Use Cases
    this.decomposeGoal = new DecomposeGoal(this.aiDecomposerService);
    this.applyGoalProposal = new ApplyGoalProposal(this.createTask);

    ServiceContainer.instance = this;
  }

  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error('ServiceContainer has not been initialized yet.');
    }
    return ServiceContainer.instance;
  }

  public getTaskRepository(): ITaskRepository {
    return this.taskRepository;
  }

  public getAuthService(): IAuthService {
    return this.authService;
  }

  public getSyncEngine(): SyncEngine {
    if (!this.syncEngine) {
      throw new Error('SyncEngine is not configured in this container.');
    }
    return this.syncEngine;
  }

  public getSyncRepository(): ISyncRepository | undefined {
    return this.syncRepository;
  }
}
