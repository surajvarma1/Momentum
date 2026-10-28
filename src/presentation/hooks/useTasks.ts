/**
 * Hook for loading and managing the task list.
 * Reads from SQLite via use cases, provides loading/error states.
 */

import { useState, useEffect, useCallback } from 'react';
import { Task, TaskFilter } from '../../domain/entities/Task';
import { useServices } from './useServices';
import { useUIStore } from '../stores/uiStore';

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  filterTasks: (filter: TaskFilter) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  reopenTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export function useTasks(initialFilter?: TaskFilter): UseTasksResult {
  const services = useServices();
  const tasksRevision = useUIStore((s) => s.tasksRevision);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<TaskFilter | undefined>(initialFilter);

  const loadTasks = useCallback(async (filter?: TaskFilter) => {
    try {
      setLoading(true);
      setError(null);
      let result: Task[];
      if (filter && Object.keys(filter).length > 0) {
        result = await services.filterTasks.execute(filter);
      } else {
        result = await services.listTasks.execute();
      }
      setTasks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [services]);

  useEffect(() => {
    loadTasks(currentFilter);
  }, [loadTasks, currentFilter, tasksRevision]);

  const refresh = useCallback(async () => {
    await loadTasks(currentFilter);
  }, [loadTasks, currentFilter]);

  const filterTasks = useCallback(async (filter: TaskFilter) => {
    setCurrentFilter(filter);
    await loadTasks(filter);
  }, [loadTasks]);

  const completeTask = useCallback(async (taskId: string) => {
    try {
      await services.completeTask.execute(taskId);
      useUIStore.getState().incrementTasksRevision();
      await loadTasks(currentFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    }
  }, [services, loadTasks, currentFilter]);

  const reopenTask = useCallback(async (taskId: string) => {
    try {
      await services.reopenTask.execute(taskId);
      useUIStore.getState().incrementTasksRevision();
      await loadTasks(currentFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen task');
    }
  }, [services, loadTasks, currentFilter]);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await services.deleteTask.execute(taskId);
      useUIStore.getState().incrementTasksRevision();
      await loadTasks(currentFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }, [services, loadTasks, currentFilter]);

  return { tasks, loading, error, refresh, filterTasks, completeTask, reopenTask, deleteTask };
}
