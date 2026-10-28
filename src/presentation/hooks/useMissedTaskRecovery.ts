/**
 * Hook to coordinate Missed Task Recovery.
 */

import { useState, useEffect, useCallback } from 'react';
import { useServices } from './useServices';
import { RecoverySuggestion } from '../../domain/accountability/MissedTaskRecovery';
import { useSettingsStore } from '../stores/settingsStore';

export function useMissedTaskRecovery() {
  const services = useServices();
  const { requireDeferralReason } = useSettingsStore();

  const [suggestions, setSuggestions] = useState<RecoverySuggestion[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<RecoverySuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  const checkMissedTasks = useCallback(async () => {
    if (!services.recoverMissedTasks) return;
    try {
      setLoading(true);
      const list = await services.recoverMissedTasks.evaluatePendingRecoveries(requireDeferralReason);
      setSuggestions(list);
      if (list.length > 0 && !currentSuggestion) {
        setCurrentSuggestion(list[0]);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [services, requireDeferralReason, currentSuggestion]);

  useEffect(() => {
    checkMissedTasks();
  }, [checkMissedTasks]);

  const acceptCurrentSuggestion = async (deferralReason?: string) => {
    if (!currentSuggestion || !services.recoverMissedTasks) return;
    try {
      await services.recoverMissedTasks.applyRecovery(
        currentSuggestion.task.id,
        currentSuggestion.suggestedDeadline,
        'ACCEPTED',
        deferralReason,
      );
      advanceToNext();
    } catch {
      // Handled
    }
  };

  const rescheduleCustom = async (customDeadline: string, deferralReason?: string) => {
    if (!currentSuggestion || !services.recoverMissedTasks) return;
    try {
      await services.recoverMissedTasks.applyRecovery(
        currentSuggestion.task.id,
        customDeadline,
        'RESCHEDULED',
        deferralReason,
      );
      advanceToNext();
    } catch {
      // Handled
    }
  };

  const dismissCurrentSuggestion = async (deferralReason?: string) => {
    if (!currentSuggestion || !services.recoverMissedTasks) return;
    try {
      await services.recoverMissedTasks.applyRecovery(
        currentSuggestion.task.id,
        currentSuggestion.task.deadline || services.clock.now(),
        'DISMISSED',
        deferralReason,
      );
      advanceToNext();
    } catch {
      // Handled
    }
  };

  const advanceToNext = () => {
    setSuggestions((prev) => {
      const remaining = prev.filter((s) => s.task.id !== currentSuggestion?.task.id);
      setCurrentSuggestion(remaining.length > 0 ? remaining[0] : null);
      return remaining;
    });
  };

  return {
    pendingCount: suggestions.length,
    currentSuggestion,
    loading,
    checkMissedTasks,
    acceptCurrentSuggestion,
    rescheduleCustom,
    dismissCurrentSuggestion,
  };
}
