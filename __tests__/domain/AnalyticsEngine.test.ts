/**
 * Tests for Analytics and Deterministic Streak Calculation Engine.
 */

import { AnalyticsEngine } from '../../src/domain/analytics/AnalyticsEngine';
import { Task } from '../../src/domain/entities/Task';
import { FocusSession } from '../../src/domain/focus/FocusSession';

const makeCompletedTask = (id: string, completedAtIso: string): Task => ({
  id,
  title: `Task ${id}`,
  description: null,
  priority: 'MEDIUM',
  energyLevel: 'MEDIUM',
  status: 'COMPLETED',
  estimatedDurationMinutes: 30,
  deadline: completedAtIso,
  deadlineTimezone: 'UTC',
  tags: [],
  subtasks: [],
  recurrenceRule: null,
  createdAt: '2026-03-01T08:00:00.000Z',
  updatedAt: completedAtIso,
  completedAt: completedAtIso,
  cancelledAt: null,
  sortOrder: 0,
});

describe('AnalyticsEngine', () => {
  const NOW = '2026-03-05T14:00:00.000Z'; // March 5, 2026

  describe('calculateStreaks', () => {
    it('calculates current streak when today is completed', () => {
      // Completed on March 3, March 4, March 5
      const tasks = [
        makeCompletedTask('t-1', '2026-03-03T10:00:00.000Z'),
        makeCompletedTask('t-2', '2026-03-04T12:00:00.000Z'),
        makeCompletedTask('t-3', '2026-03-05T09:00:00.000Z'),
      ];

      const { currentStreak, bestStreak } = AnalyticsEngine.calculateStreaks(tasks, NOW);
      expect(currentStreak).toBe(3);
      expect(bestStreak).toBe(3);
    });

    it('maintains streak grace period if yesterday was completed and today is still in progress', () => {
      // Completed on March 3, March 4; None yet on March 5 (today)
      const tasks = [
        makeCompletedTask('t-1', '2026-03-03T10:00:00.000Z'),
        makeCompletedTask('t-2', '2026-03-04T12:00:00.000Z'),
      ];

      const { currentStreak, bestStreak } = AnalyticsEngine.calculateStreaks(tasks, NOW);
      expect(currentStreak).toBe(2); // Grace period: streak of 2 days is active
      expect(bestStreak).toBe(2);
    });

    it('resets current streak to 0 if a full day was missed', () => {
      // Completed on March 2, March 3; Missed March 4; Today is March 5
      const tasks = [
        makeCompletedTask('t-1', '2026-03-02T10:00:00.000Z'),
        makeCompletedTask('t-2', '2026-03-03T12:00:00.000Z'),
      ];

      const { currentStreak, bestStreak } = AnalyticsEngine.calculateStreaks(tasks, NOW);
      expect(currentStreak).toBe(0); // Broken streak
      expect(bestStreak).toBe(2);   // All-time best preserved
    });

    it('prevents multiple completions on the same day from inflating streak counts', () => {
      // 5 tasks completed on the same day (March 5)
      const tasks = [
        makeCompletedTask('t-1', '2026-03-05T09:00:00.000Z'),
        makeCompletedTask('t-2', '2026-03-05T10:00:00.000Z'),
        makeCompletedTask('t-3', '2026-03-05T11:00:00.000Z'),
        makeCompletedTask('t-4', '2026-03-05T12:00:00.000Z'),
        makeCompletedTask('t-5', '2026-03-05T13:00:00.000Z'),
      ];

      const { currentStreak, bestStreak } = AnalyticsEngine.calculateStreaks(tasks, NOW);
      expect(currentStreak).toBe(1); // 1 day streak, not 5!
      expect(bestStreak).toBe(1);
    });
  });

  describe('generateSummary', () => {
    it('accurately aggregates tasks and focus minutes', () => {
      const tasks = [
        makeCompletedTask('t-1', '2026-03-05T10:00:00.000Z'),
        { ...makeCompletedTask('t-2', '2026-03-05T10:00:00.000Z'), status: 'PENDING' as const, completedAt: null },
      ];

      const sampleSessions: FocusSession[] = [
        {
          id: 'f-1',
          taskId: 't-1',
          state: 'COMPLETED',
          targetDurationMs: 25 * 60 * 1000,
          breakDurationMs: 5 * 60 * 1000,
          startTime: '2026-03-05T09:00:00.000Z',
          pauseTime: null,
          accumulatedPausedMs: 0,
          completedAt: '2026-03-05T09:25:00.000Z',
          cancelledAt: null,
          actualFocusDurationMs: 25 * 60 * 1000,
          notes: null,
          interruptionLogged: false,
          interruptionReason: null,
          createdAt: '2026-03-05T09:00:00.000Z',
          updatedAt: '2026-03-05T09:25:00.000Z',
        },
      ];

      const summary = AnalyticsEngine.generateSummary(tasks, sampleSessions, NOW);

      expect(summary.totalCompletedTasks).toBe(1);
      expect(summary.totalPlannedTasks).toBe(2);
      expect(summary.overallCompletionRate).toBe(50);
      expect(summary.totalFocusMinutes).toBe(25);
      expect(summary.completedFocusSessions).toBe(1);
      expect(summary.focusSessionCompletionRate).toBe(100);
      expect(summary.recentDays).toHaveLength(7);
    });
  });
});
