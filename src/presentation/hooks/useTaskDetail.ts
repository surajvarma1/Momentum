/**
 * Hook for loading a single task detail.
 */

import { useState, useEffect, useCallback } from 'react';
import { Task } from '../../domain/entities/Task';
import { useServices } from './useServices';

interface UseTaskDetailResult {
  task: Task | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  completeTask: () => Promise<void>;
  reopenTask: () => Promise<void>;
  cancelTask: () => Promise<void>;
  deleteTask: () => Promise<void>;
}

export function useTaskDetail(taskId: string | undefined): UseTaskDetailResult {
  const services = useServices();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await services.taskRepository.findById(taskId);
      setTask(result);
      if (!result) setError('Task not found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId, services]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const refresh = useCallback(async () => {
    await loadTask();
  }, [loadTask]);

  const completeTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const updated = await services.completeTask.execute(taskId);
      setTask(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    }
  }, [taskId, services]);

  const reopenTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const updated = await services.reopenTask.execute(taskId);
      setTask(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen task');
    }
  }, [taskId, services]);

  const cancelTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const updated = await services.cancelTask.execute(taskId);
      setTask(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
    }
  }, [taskId, services]);

  const deleteTask = useCallback(async () => {
    if (!taskId) return;
    try {
      await services.deleteTask.execute(taskId);
      setTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }, [taskId, services]);

  return { task, loading, error, refresh, completeTask, reopenTask, cancelTask, deleteTask };
}
