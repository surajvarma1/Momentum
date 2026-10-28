/**
 * Tests for domain use cases.
 * Uses in-memory mock repository for isolation.
 */

import { CreateTask, TaskValidationError, TaskNotFoundError, ITaskRepository, IClock, IIdGenerator } from '../../src/domain/use-cases/CreateTask';
import { UpdateTask } from '../../src/domain/use-cases/UpdateTask';
import { CompleteTask } from '../../src/domain/use-cases/CompleteTask';
import { ReopenTask } from '../../src/domain/use-cases/ReopenTask';
import { CancelTask } from '../../src/domain/use-cases/CancelTask';
import { DeleteTask } from '../../src/domain/use-cases/DeleteTask';
import { ListTasks } from '../../src/domain/use-cases/ListTasks';
import { FilterTasks } from '../../src/domain/use-cases/FilterTasks';
import { Task, TaskFilter } from '../../src/domain/entities/Task';
import { Subtask } from '../../src/domain/entities/Subtask';

// --- Test doubles ---

class TestClock implements IClock {
  private time: string;
  constructor(time = '2026-01-15T10:00:00.000Z') {
    this.time = time;
  }
  now(): string {
    return this.time;
  }
  advance(ms: number): void {
    this.time = new Date(new Date(this.time).getTime() + ms).toISOString();
  }
}

class TestIdGenerator implements IIdGenerator {
  private counter = 0;
  generate(): string {
    this.counter++;
    return `id-${String(this.counter).padStart(4, '0')}`;
  }
  reset(): void {
    this.counter = 0;
  }
}

class InMemoryTaskRepository implements ITaskRepository {
  private tasks = new Map<string, { task: Omit<Task, 'subtasks'>; subtasks: Subtask[] }>();

  async create(
    task: Omit<Task, 'subtasks'>,
    subtasks: Array<{
      id: string; taskId: string; title: string;
      isCompleted: boolean; sortOrder: number; createdAt: string; updatedAt: string;
    }>,
  ): Promise<Task> {
    const subs: Subtask[] = subtasks.map((s) => ({
      id: s.id,
      taskId: s.taskId,
      title: s.title,
      isCompleted: s.isCompleted,
      sortOrder: s.sortOrder,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    this.tasks.set(task.id, { task, subtasks: subs });
    return { ...task, subtasks: subs };
  }

  async findById(id: string): Promise<Task | null> {
    const entry = this.tasks.get(id);
    if (!entry) return null;
    return { ...entry.task, subtasks: [...entry.subtasks] };
  }

  async findAll(): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .map((e) => ({ ...e.task, subtasks: [...e.subtasks] }))
      .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
  }

  async filter(filter: TaskFilter, now: string): Promise<Task[]> {
    let results = Array.from(this.tasks.values()).map((e) => ({
      ...e.task,
      subtasks: [...e.subtasks],
    }));

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      results = results.filter((t) => statuses.includes(t.status as any));
    }
    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      results = results.filter((t) => priorities.includes(t.priority as any));
    }
    if (filter.isOverdue) {
      results = results.filter(
        (t) =>
          t.deadline &&
          t.deadline < now &&
          t.status !== 'COMPLETED' &&
          t.status !== 'CANCELLED',
      );
    }
    if (filter.dueBefore) {
      results = results.filter((t) => t.deadline && t.deadline <= filter.dueBefore!);
    }
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      results = results.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }

    return results.sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
  }

  async update(
    id: string,
    updates: Partial<Omit<Task, 'id' | 'subtasks' | 'createdAt'>>,
  ): Promise<Task> {
    const entry = this.tasks.get(id);
    if (!entry) throw new Error(`Task not found: ${id}`);
    const updatedTask = { ...entry.task, ...updates };
    this.tasks.set(id, { task: updatedTask, subtasks: entry.subtasks });
    return { ...updatedTask, subtasks: [...entry.subtasks] };
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async addSubtask(
    taskId: string,
    subtask: { id: string; title: string; isCompleted: boolean; sortOrder: number; createdAt: string; updatedAt: string },
  ): Promise<Subtask> {
    const entry = this.tasks.get(taskId);
    if (!entry) throw new Error(`Task not found: ${taskId}`);
    const s: Subtask = { ...subtask, taskId };
    entry.subtasks.push(s);
    return s;
  }

  async updateSubtask(subtaskId: string, updates: { title?: string; isCompleted?: boolean; sortOrder?: number; updatedAt: string }): Promise<void> {
    for (const entry of this.tasks.values()) {
      const idx = entry.subtasks.findIndex((s) => s.id === subtaskId);
      if (idx >= 0) {
        entry.subtasks[idx] = { ...entry.subtasks[idx], ...updates };
        return;
      }
    }
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    for (const entry of this.tasks.values()) {
      entry.subtasks = entry.subtasks.filter((s) => s.id !== subtaskId);
    }
  }

  async count(status?: string | string[]): Promise<number> {
    if (!status) return this.tasks.size;
    const statuses = Array.isArray(status) ? status : [status];
    return Array.from(this.tasks.values()).filter((e) => statuses.includes(e.task.status)).length;
  }
}

// --- Test setup ---

function createTestContext() {
  const clock = new TestClock();
  const idGen = new TestIdGenerator();
  const repo = new InMemoryTaskRepository();
  return {
    clock,
    idGen,
    repo,
    createTask: new CreateTask(repo, idGen, clock),
    updateTask: new UpdateTask(repo, clock),
    completeTask: new CompleteTask(repo, clock),
    reopenTask: new ReopenTask(repo, clock),
    cancelTask: new CancelTask(repo, clock),
    deleteTask: new DeleteTask(repo),
    listTasks: new ListTasks(repo),
    filterTasks: new FilterTasks(repo, clock),
  };
}

// --- Tests ---

describe('CreateTask', () => {
  it('creates a task with defaults', async () => {
    const { createTask } = createTestContext();
    const task = await createTask.execute({ title: 'Buy groceries' });
    expect(task.title).toBe('Buy groceries');
    expect(task.status).toBe('PENDING');
    expect(task.priority).toBe('MEDIUM');
    expect(task.energyLevel).toBe('MEDIUM');
    expect(task.id).toBe('id-0001');
    expect(task.completedAt).toBeNull();
  });

  it('creates a task with all fields', async () => {
    const { createTask } = createTestContext();
    const task = await createTask.execute({
      title: 'Complete project',
      description: 'Phase 1',
      priority: 'HIGH',
      energyLevel: 'HIGH',
      estimatedDurationMinutes: 120,
      deadline: '2026-02-01T10:00:00.000Z',
      deadlineTimezone: 'America/New_York',
      tags: ['work'],
      subtasks: [{ title: 'Step 1' }, { title: 'Step 2' }],
    });
    expect(task.priority).toBe('HIGH');
    expect(task.tags).toEqual(['work']);
    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0].title).toBe('Step 1');
  });

  it('rejects invalid input', async () => {
    const { createTask } = createTestContext();
    await expect(createTask.execute({ title: '' })).rejects.toThrow(TaskValidationError);
  });

  it('assigns unique IDs to task and subtasks', async () => {
    const { createTask } = createTestContext();
    const task = await createTask.execute({
      title: 'Test',
      subtasks: [{ title: 'Sub 1' }, { title: 'Sub 2' }],
    });
    expect(task.id).toBe('id-0001');
    expect(task.subtasks[0].id).toBe('id-0002');
    expect(task.subtasks[1].id).toBe('id-0003');
  });
});

describe('UpdateTask', () => {
  it('updates task fields', async () => {
    const { createTask, updateTask } = createTestContext();
    const task = await createTask.execute({ title: 'Original' });
    const updated = await updateTask.execute(task.id, {
      title: 'Updated',
      priority: 'HIGH',
    });
    expect(updated.title).toBe('Updated');
    expect(updated.priority).toBe('HIGH');
  });

  it('throws for non-existent task', async () => {
    const { updateTask } = createTestContext();
    await expect(updateTask.execute('nonexistent', { title: 'X' })).rejects.toThrow(TaskNotFoundError);
  });
});

describe('CompleteTask', () => {
  it('completes a pending task', async () => {
    const { createTask, completeTask } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    const completed = await completeTask.execute(task.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).not.toBeNull();
  });

  it('is idempotent for already completed tasks (duplicate completion is safe)', async () => {
    const { createTask, completeTask } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    const first = await completeTask.execute(task.id);
    const second = await completeTask.execute(task.id);
    expect(second.status).toBe('COMPLETED');
    expect(second.completedAt).toBe(first.completedAt);
  });

  it('throws for non-existent task', async () => {
    const { completeTask } = createTestContext();
    await expect(completeTask.execute('nonexistent')).rejects.toThrow(TaskNotFoundError);
  });
});

describe('ReopenTask', () => {
  it('reopens a completed task', async () => {
    const { createTask, completeTask, reopenTask } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    await completeTask.execute(task.id);
    const reopened = await reopenTask.execute(task.id);
    expect(reopened.status).toBe('PENDING');
    expect(reopened.completedAt).toBeNull();
  });

  it('reopens a cancelled task', async () => {
    const { createTask, cancelTask, reopenTask } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    await cancelTask.execute(task.id);
    const reopened = await reopenTask.execute(task.id);
    expect(reopened.status).toBe('PENDING');
    expect(reopened.cancelledAt).toBeNull();
  });

  it('throws for already pending task', async () => {
    const { createTask, reopenTask } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    await expect(reopenTask.execute(task.id)).rejects.toThrow(TaskValidationError);
  });
});

describe('CancelTask', () => {
  it('cancels a pending task', async () => {
    const { createTask, cancelTask } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    const cancelled = await cancelTask.execute(task.id);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it('throws for already completed task', async () => {
    const { createTask, completeTask, cancelTask } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    await completeTask.execute(task.id);
    await expect(cancelTask.execute(task.id)).rejects.toThrow(TaskValidationError);
  });
});

describe('DeleteTask', () => {
  it('deletes an existing task', async () => {
    const { createTask, deleteTask, repo } = createTestContext();
    const task = await createTask.execute({ title: 'Test' });
    await deleteTask.execute(task.id);
    const found = await repo.findById(task.id);
    expect(found).toBeNull();
  });

  it('throws for non-existent task', async () => {
    const { deleteTask } = createTestContext();
    await expect(deleteTask.execute('nonexistent')).rejects.toThrow(TaskNotFoundError);
  });
});

describe('ListTasks', () => {
  it('returns empty array when no tasks', async () => {
    const { listTasks } = createTestContext();
    const result = await listTasks.execute();
    expect(result).toEqual([]);
  });

  it('returns all tasks sorted by sortOrder', async () => {
    const { createTask, listTasks } = createTestContext();
    await createTask.execute({ title: 'B', sortOrder: 2 });
    await createTask.execute({ title: 'A', sortOrder: 1 });
    await createTask.execute({ title: 'C', sortOrder: 3 });
    const result = await listTasks.execute();
    expect(result.map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });
});

describe('FilterTasks', () => {
  it('filters by status', async () => {
    const { createTask, completeTask, filterTasks } = createTestContext();
    await createTask.execute({ title: 'Pending' });
    const task2 = await createTask.execute({ title: 'Completed' });
    await completeTask.execute(task2.id);

    const pending = await filterTasks.execute({ status: 'PENDING' });
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe('Pending');

    const completed = await filterTasks.execute({ status: 'COMPLETED' });
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe('Completed');
  });

  it('filters overdue tasks', async () => {
    const { createTask, filterTasks, clock } = createTestContext();
    // Create task with past deadline
    await createTask.execute({
      title: 'Overdue',
      deadline: '2026-01-20T10:00:00.000Z',
    });
    await createTask.execute({ title: 'No deadline' });

    // Advance clock past the deadline
    clock.advance(10 * 24 * 60 * 60 * 1000); // 10 days

    const overdue = await filterTasks.execute({ isOverdue: true });
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe('Overdue');
  });

  it('filters by search query', async () => {
    const { createTask, filterTasks } = createTestContext();
    await createTask.execute({ title: 'Buy groceries' });
    await createTask.execute({ title: 'Read book' });

    const results = await filterTasks.execute({ searchQuery: 'groceries' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Buy groceries');
  });

  it('filters by priority', async () => {
    const { createTask, filterTasks } = createTestContext();
    await createTask.execute({ title: 'Low', priority: 'LOW' });
    await createTask.execute({ title: 'High', priority: 'HIGH' });

    const results = await filterTasks.execute({ priority: 'HIGH' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('High');
  });
});

describe('Subtask operations', () => {
  it('creates task with subtasks', async () => {
    const { createTask } = createTestContext();
    const task = await createTask.execute({
      title: 'Parent',
      subtasks: [{ title: 'Child 1' }, { title: 'Child 2' }],
    });
    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0].title).toBe('Child 1');
    expect(task.subtasks[1].title).toBe('Child 2');
    expect(task.subtasks[0].isCompleted).toBe(false);
  });
});
