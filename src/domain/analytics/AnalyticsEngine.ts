/**
 * Analytics and Deterministic Streak Calculation Engine.
 *
 * Rules:
 * - Streaks require verified completed tasks on consecutive calendar days.
 * - Timezone-aware date normalization prevents boundary shifts from breaking streaks.
 * - Duplicate completions of the same task cannot inflate counts.
 * - Focus time is kept distinct from task completions.
 */

import { Task } from '../entities/Task';
import { FocusSession } from '../focus/FocusSession';

export interface DayAnalytics {
  date: string; // "YYYY-MM-DD"
  plannedCount: number;
  completedCount: number;
  focusMinutes: number;
}

export interface AnalyticsSummary {
  totalCompletedTasks: number;
  totalPlannedTasks: number;
  overallCompletionRate: number; // 0-100%
  totalFocusMinutes: number;
  totalFocusSessions: number;
  completedFocusSessions: number;
  focusSessionCompletionRate: number; // 0-100%
  currentStreakDays: number;
  bestStreakDays: number;
  recentDays: DayAnalytics[];
}

export class AnalyticsEngine {
  /**
   * Formats a UTC ISO timestamp to a calendar date string (YYYY-MM-DD)
   * in the specified timezone (or local if unspecified).
   */
  static getLocalDateString(isoTimestamp: string, timezone?: string): string {
    const date = new Date(isoTimestamp);
    if (!timezone) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    } catch {
      return isoTimestamp.split('T')[0];
    }
  }

  /**
   * Calculates consecutive days streak of completed tasks.
   * If today has no completed task yet, checks if yesterday has one to preserve active streak.
   */
  static calculateStreaks(
    tasks: Task[],
    nowIso: string,
    timezone?: string,
  ): { currentStreak: number; bestStreak: number } {
    const todayStr = this.getLocalDateString(nowIso, timezone);

    // Collect distinct dates where at least one unique task was completed
    const completionDates = new Set<string>();
    tasks.forEach((t) => {
      if (t.status === 'COMPLETED') {
        const timestamp = t.completedAt || t.updatedAt;
        if (timestamp) {
          const d = this.getLocalDateString(timestamp, timezone);
          completionDates.add(d);
        }
      }
    });

    if (completionDates.size === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    // Sort distinct dates ascending
    const sortedDates = Array.from(completionDates).sort();

    // Calculate best streak historically
    let bestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const dStr of sortedDates) {
      const curDate = new Date(dStr + 'T00:00:00.000Z');
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      prevDate = curDate;
      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
      }
    }

    // Calculate current streak relative to today
    let currentStreak = 0;
    const nowLocalDate = new Date(todayStr + 'T00:00:00.000Z');

    // Check if today is completed
    const hasToday = completionDates.has(todayStr);

    // If today is not completed, check if yesterday was completed
    let checkDate = new Date(nowLocalDate);
    if (!hasToday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const checkStr = checkDate.toISOString().split('T')[0];
      if (completionDates.has(checkStr)) {
        currentStreak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak) };
  }

  /**
   * Generates a complete comprehensive analytics summary from persisted records.
   */
  static generateSummary(
    tasks: Task[],
    sessions: FocusSession[],
    nowIso: string,
    timezone?: string,
  ): AnalyticsSummary {
    const totalPlanned = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
    const totalCompleted = completedTasks.length;
    const overallRate = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

    // Focus metrics
    let totalFocusMs = 0;
    let completedSessionsCount = 0;

    sessions.forEach((s) => {
      totalFocusMs += s.actualFocusDurationMs;
      if (s.state === 'COMPLETED') {
        completedSessionsCount += 1;
      }
    });

    const totalFocusMinutes = Math.round(totalFocusMs / (60 * 1000));
    const totalSessions = sessions.length;
    const sessionRate = totalSessions > 0 ? Math.round((completedSessionsCount / totalSessions) * 100) : 0;

    const { currentStreak, bestStreak } = this.calculateStreaks(tasks, nowIso, timezone);

    // Recent 7 days breakdown
    const recentDays: DayAnalytics[] = [];
    const today = new Date(nowIso);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStr = this.getLocalDateString(d.toISOString(), timezone);

      const plannedForDay = tasks.filter((t) => {
        const createdOnDay = this.getLocalDateString(t.createdAt, timezone) === dStr;
        const dueOnDay = t.deadline ? this.getLocalDateString(t.deadline, timezone) === dStr : false;
        return createdOnDay || dueOnDay;
      }).length;

      const completedOnDay = tasks.filter(
        (t) =>
          t.status === 'COMPLETED' &&
          (t.completedAt || t.updatedAt) &&
          this.getLocalDateString(t.completedAt || t.updatedAt, timezone) === dStr,
      ).length;

      let focusMsOnDay = 0;
      sessions.forEach((s) => {
        if (this.getLocalDateString(s.startTime, timezone) === dStr) {
          focusMsOnDay += s.actualFocusDurationMs;
        }
      });

      recentDays.push({
        date: dStr,
        plannedCount: plannedForDay,
        completedCount: completedOnDay,
        focusMinutes: Math.round(focusMsOnDay / (60 * 1000)),
      });
    }

    return {
      totalCompletedTasks: totalCompleted,
      totalPlannedTasks: totalPlanned,
      overallCompletionRate: overallRate,
      totalFocusMinutes,
      totalFocusSessions: totalSessions,
      completedFocusSessions: completedSessionsCount,
      focusSessionCompletionRate: sessionRate,
      currentStreakDays: currentStreak,
      bestStreakDays: bestStreak,
      recentDays,
    };
  }
}
