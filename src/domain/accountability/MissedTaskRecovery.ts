/**
 * Missed Task Recovery & Accountability Domain Engine.
 *
 * Rules:
 * 1. Backgrounding the app is an ordinary lifecycle event, never auto-penalized.
 * 2. Missed tasks (overdue, incomplete) are identified and offered realistic reschedule options.
 * 3. Deferral reasons for HIGH/IMPORTANT tasks are requested ONLY if user explicitly enabled the preference.
 * 4. Duplicate recovery prompts are avoided by checking existing records.
 */

import { Task } from '../entities/Task';

export interface MissedTaskRecord {
  readonly id: string;
  readonly taskId: string;
  readonly detectedAt: string; // ISO 8601 UTC
  readonly suggestedDeadline: string; // ISO 8601 UTC
  readonly actionTaken: 'ACCEPTED' | 'RESCHEDULED' | 'DISMISSED' | null;
  readonly resolvedAt: string | null;
  readonly deferralReason: string | null;
  readonly createdAt: string;
}

export interface RecoverySuggestion {
  task: Task;
  suggestedDeadline: string;
  requiresDeferralReason: boolean;
}

export class MissedTaskRecoveryEngine {
  /**
   * Generates a realistic rescheduled deadline.
   * If detected before 15:00 local time, suggest today at 18:00.
   * If detected after 15:00, suggest tomorrow at 09:00.
   */
  static generateSuggestedDeadline(nowIso: string): string {
    const now = new Date(nowIso);
    const suggested = new Date(now);

    if (now.getUTCHours() < 15) {
      suggested.setUTCHours(18, 0, 0, 0);
    } else {
      suggested.setUTCDate(suggested.getUTCDate() + 1);
      suggested.setUTCHours(9, 0, 0, 0);
    }

    return suggested.toISOString();
  }

  /**
   * Evaluates if a task qualifies for missed-task recovery and checks accountability rules.
   */
  static evaluateMissedTask(
    task: Task,
    nowIso: string,
    existingRecordsForTask: MissedTaskRecord[],
    requireDeferralReasons: boolean = false,
  ): RecoverySuggestion | null {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      return null;
    }

    if (!task.deadline || task.deadline >= nowIso) {
      return null;
    }

    // Check if an unresolved recovery prompt already exists for this task today
    const todayDateStr = nowIso.split('T')[0];
    const alreadyPromptedToday = existingRecordsForTask.some(
      (r) => r.detectedAt.startsWith(todayDateStr) && r.actionTaken === null,
    );

    if (alreadyPromptedToday) {
      return null;
    }

    const requiresReason =
      requireDeferralReasons && (task.priority === 'HIGH' || task.priority === 'IMPORTANT');

    return {
      task,
      suggestedDeadline: this.generateSuggestedDeadline(nowIso),
      requiresDeferralReason: requiresReason,
    };
  }
}
