/**
 * Hook to manage reminders for a task.
 */

import { useState, useEffect, useCallback } from 'react';
import { Reminder } from '../../domain/reminders/Reminder';
import { useServices } from './useServices';
import { useSettingsStore } from '../stores/settingsStore';

export function useReminders(taskId?: string) {
  const services = useServices();
  const { remindersEnabled, quietHoursStart, quietHoursEnd, nagModeEnabled, maxNagRepeats } =
    useSettingsStore();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    if (!taskId || !services.reminderRepository) return;
    try {
      setLoading(true);
      setError(null);
      const list = await services.reminderRepository.findByTaskId(taskId);
      setReminders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, [taskId, services]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const addReminder = async (params: {
    triggerTime: string;
    type?: 'ONE_TIME' | 'BEFORE_DEADLINE' | 'RECURRING';
    offsetMinutes?: number;
    isNag?: boolean;
  }) => {
    if (!taskId || !services.createReminder) return;

    try {
      setError(null);
      const quietHours = {
        enabled: remindersEnabled,
        start: quietHoursStart,
        end: quietHoursEnd,
      };

      await services.createReminder.execute(
        {
          taskId,
          type: params.type || 'ONE_TIME',
          triggerTime: params.triggerTime,
          offsetMinutes: params.offsetMinutes,
          isNagEnabled: params.isNag ?? nagModeEnabled,
          maxRepeats: maxNagRepeats,
        },
        quietHours,
      );

      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule reminder');
      throw err;
    }
  };

  const snooze = async (reminderId: string, minutes: number = 15) => {
    if (!services.snoozeReminder) return;
    try {
      const quietHours = {
        enabled: remindersEnabled,
        start: quietHoursStart,
        end: quietHoursEnd,
      };

      await services.snoozeReminder.execute(
        { reminderId, snoozeMinutes: minutes },
        quietHours,
      );
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to snooze reminder');
    }
  };

  const cancel = async (reminderId: string) => {
    if (!services.cancelReminder) return;
    try {
      await services.cancelReminder.execute(reminderId);
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reminder');
    }
  };

  return {
    reminders,
    loading,
    error,
    refresh: loadReminders,
    addReminder,
    snooze,
    cancel,
  };
}
