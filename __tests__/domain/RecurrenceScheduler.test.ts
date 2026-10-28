/**
 * Tests for deterministic recurrence, impossible date clamping,
 * quiet hours shifts, and bounded Nag Mode.
 */

import { RecurrenceScheduler, QuietHours } from '../../src/domain/reminders/RecurrenceScheduler';
import { RecurrenceRule } from '../../src/domain/value-objects/RecurrenceRule';

describe('RecurrenceScheduler', () => {
  const quietHoursSpanningMidnight: QuietHours = {
    enabled: true,
    start: '22:00',
    end: '07:00',
  };

  describe('calculateBeforeDeadline', () => {
    it('calculates trigger 15 minutes before deadline', () => {
      const deadline = '2026-06-15T10:00:00.000Z';
      const trigger = RecurrenceScheduler.calculateBeforeDeadline(deadline, 15);
      expect(trigger).toBe('2026-06-15T09:45:00.000Z');
    });

    it('calculates trigger 1 day (1440 mins) before deadline', () => {
      const deadline = '2026-06-15T10:00:00.000Z';
      const trigger = RecurrenceScheduler.calculateBeforeDeadline(deadline, 1440);
      expect(trigger).toBe('2026-06-14T10:00:00.000Z');
    });
  });

  describe('isInsideQuietHours and adjustForQuietHours', () => {
    it('detects timestamps inside quiet hours spanning midnight', () => {
      // 23:30 local time
      const date1 = new Date();
      date1.setHours(23, 30, 0, 0);
      expect(RecurrenceScheduler.isInsideQuietHours(date1.toISOString(), quietHoursSpanningMidnight)).toBe(true);

      // 04:15 local time
      const date2 = new Date();
      date2.setHours(4, 15, 0, 0);
      expect(RecurrenceScheduler.isInsideQuietHours(date2.toISOString(), quietHoursSpanningMidnight)).toBe(true);

      // 14:00 local time (outside)
      const date3 = new Date();
      date3.setHours(14, 0, 0, 0);
      expect(RecurrenceScheduler.isInsideQuietHours(date3.toISOString(), quietHoursSpanningMidnight)).toBe(false);
    });

    it('shifts late night trigger to 07:00 next morning', () => {
      const lateNight = new Date();
      lateNight.setHours(23, 15, 0, 0);
      const adjustedIso = RecurrenceScheduler.adjustForQuietHours(lateNight.toISOString(), quietHoursSpanningMidnight);
      const adjustedDate = new Date(adjustedIso);

      expect(adjustedDate.getHours()).toBe(7);
      expect(adjustedDate.getMinutes()).toBe(0);
      // Next day
      expect(adjustedDate.getDate()).not.toBe(lateNight.getDate());
    });

    it('shifts early morning trigger to 07:00 same morning', () => {
      const earlyMorning = new Date();
      earlyMorning.setHours(5, 30, 0, 0);
      const adjustedIso = RecurrenceScheduler.adjustForQuietHours(earlyMorning.toISOString(), quietHoursSpanningMidnight);
      const adjustedDate = new Date(adjustedIso);

      expect(adjustedDate.getHours()).toBe(7);
      expect(adjustedDate.getMinutes()).toBe(0);
      expect(adjustedDate.getDate()).toBe(earlyMorning.getDate());
    });

    it('leaves timestamps outside quiet hours unchanged', () => {
      const midday = new Date();
      midday.setHours(12, 0, 0, 0);
      const iso = midday.toISOString();
      expect(RecurrenceScheduler.adjustForQuietHours(iso, quietHoursSpanningMidnight)).toBe(iso);
    });
  });

  describe('Monthly Recurrence & Impossible Dates Handling', () => {
    it('clamps 31st to 30th on months with 30 days (e.g. April)', () => {
      const rule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        dayOfMonth: 31,
      };

      // March 31 -> next month is April (only 30 days)
      const current = '2026-03-31T09:00:00.000Z';
      const now = '2026-03-31T12:00:00.000Z';
      const next = RecurrenceScheduler.getNextOccurrence(rule, current, now);

      expect(next).not.toBeNull();
      const nextDate = new Date(next!);
      expect(nextDate.getUTCMonth()).toBe(3); // April (0-indexed 3)
      expect(nextDate.getUTCDate()).toBe(30); // Clamped from 31 to 30
      expect(nextDate.getUTCHours()).toBe(9);
    });

    it('clamps 31st to Feb 28 on a non-leap year', () => {
      const rule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        dayOfMonth: 31,
      };

      // Jan 31 2026 -> next month is Feb 2026 (non-leap year, 28 days)
      const current = '2026-01-31T09:00:00.000Z';
      const now = '2026-01-31T12:00:00.000Z';
      const next = RecurrenceScheduler.getNextOccurrence(rule, current, now);

      expect(next).not.toBeNull();
      const nextDate = new Date(next!);
      expect(nextDate.getUTCMonth()).toBe(1); // Feb
      expect(nextDate.getUTCDate()).toBe(28); // Clamped to 28
    });

    it('clamps 31st to Feb 29 on a leap year (e.g. 2028)', () => {
      const rule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        dayOfMonth: 31,
      };

      // Jan 31 2028 -> next month is Feb 2028 (leap year, 29 days)
      const current = '2028-01-31T09:00:00.000Z';
      const now = '2028-01-31T12:00:00.000Z';
      const next = RecurrenceScheduler.getNextOccurrence(rule, current, now);

      expect(next).not.toBeNull();
      const nextDate = new Date(next!);
      expect(nextDate.getUTCMonth()).toBe(1); // Feb
      expect(nextDate.getUTCDate()).toBe(29); // Clamped to 29
    });

    it('recovers 31st for May after being clamped in April', () => {
      const rule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        dayOfMonth: 31,
      };

      // April 30 -> next month is May (has 31 days)
      const current = '2026-04-30T09:00:00.000Z';
      const now = '2026-04-30T12:00:00.000Z';
      const next = RecurrenceScheduler.getNextOccurrence(rule, current, now);

      expect(next).not.toBeNull();
      const nextDate = new Date(next!);
      expect(nextDate.getUTCMonth()).toBe(4); // May
      expect(nextDate.getUTCDate()).toBe(31); // Preserved intended 31st
    });
  });

  describe('Weekly Recurrence with Selected Weekdays', () => {
    it('schedules through selected weekdays (Mon, Wed, Fri)', () => {
      const rule: RecurrenceRule = {
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      };

      // Monday 2026-01-05
      const current = '2026-01-05T10:00:00.000Z';
      const now = '2026-01-05T12:00:00.000Z';

      // Next should be Wednesday 2026-01-07
      const nextWed = RecurrenceScheduler.getNextOccurrence(rule, current, now);
      expect(nextWed).not.toBeNull();
      expect(new Date(nextWed!).getUTCDay()).toBe(3); // Wed

      // From Wednesday 2026-01-07, next should be Friday 2026-01-09
      const nextFri = RecurrenceScheduler.getNextOccurrence(rule, nextWed!, '2026-01-07T12:00:00.000Z');
      expect(nextFri).not.toBeNull();
      expect(new Date(nextFri!).getUTCDay()).toBe(5); // Fri

      // From Friday 2026-01-09, next should wrap to Monday 2026-01-12
      const nextMon = RecurrenceScheduler.getNextOccurrence(rule, nextFri!, '2026-01-09T12:00:00.000Z');
      expect(nextMon).not.toBeNull();
      expect(new Date(nextMon!).getUTCDay()).toBe(1); // Mon
    });

    it('respects recurrence endDate boundary', () => {
      const rule: RecurrenceRule = {
        frequency: 'DAILY',
        interval: 1,
        endDate: '2026-01-10T00:00:00.000Z',
      };

      const current = '2026-01-09T10:00:00.000Z';
      const now = '2026-01-09T12:00:00.000Z';
      const next = RecurrenceScheduler.getNextOccurrence(rule, current, now);

      // Next is Jan 10 10:00 which is after endDate Jan 10 00:00
      expect(next).toBeNull();
    });
  });

  describe('Bounded Nag Mode Repeats', () => {
    it('schedules next repeat when below max repeats', () => {
      const current = '2026-01-01T10:00:00.000Z';
      const nextNag = RecurrenceScheduler.getNextNagTrigger(current, 0, 3, 15);
      expect(nextNag).toBe('2026-01-01T10:15:00.000Z');
    });

    it('returns null when repeat count reaches max repeats limit', () => {
      const current = '2026-01-01T10:00:00.000Z';
      const nextNag = RecurrenceScheduler.getNextNagTrigger(current, 3, 3, 15);
      expect(nextNag).toBeNull();
    });

    it('shifts nag reminder through quiet hours', () => {
      const current = new Date();
      current.setHours(22, 50, 0, 0); // 22:50
      const nextNag = RecurrenceScheduler.getNextNagTrigger(
        current.toISOString(),
        1,
        3,
        15,
        quietHoursSpanningMidnight,
      );

      expect(nextNag).not.toBeNull();
      const date = new Date(nextNag!);
      expect(date.getHours()).toBe(7); // Shifted to morning
      expect(date.getMinutes()).toBe(0);
    });
  });
});
