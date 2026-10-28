/**
 * Deterministic Recurrence & Reminder Scheduling Service.
 * Separated from any native notification API.
 * Pure logic for recurring schedules, DST wall-clock preservation,
 * monthly impossible date clamping, quiet hours, and bounded Nag Mode.
 */

import { RecurrenceRule } from '../value-objects/RecurrenceRule';

export interface QuietHours {
  enabled: boolean;
  start: string; // "HH:mm", e.g. "22:00"
  end: string;   // "HH:mm", e.g. "07:00"
}

export class RecurrenceScheduler {
  /**
   * Calculates the trigger time for a reminder before a deadline.
   * If offsetMinutes is 15, trigger is deadline - 15 minutes.
   */
  static calculateBeforeDeadline(deadline: string, offsetMinutes: number): string {
    const deadlineDate = new Date(deadline);
    const triggerDate = new Date(deadlineDate.getTime() - offsetMinutes * 60 * 1000);
    return triggerDate.toISOString();
  }

  /**
   * Determines if a given UTC ISO string falls within the user's quiet hours window.
   * Assumes timezone or local date interpretation.
   */
  static isInsideQuietHours(isoTimestamp: string, quietHours: QuietHours, timezone?: string): boolean {
    if (!quietHours.enabled || !quietHours.start || !quietHours.end) {
      return false;
    }

    const date = new Date(isoTimestamp);
    // Parse hours and minutes in user's timezone if provided, otherwise local
    let hours = date.getHours();
    let minutes = date.getMinutes();

    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        });
        const parts = formatter.formatToParts(date);
        const hPart = parts.find((p) => p.type === 'hour')?.value;
        const mPart = parts.find((p) => p.type === 'minute')?.value;
        if (hPart) hours = parseInt(hPart, 10);
        if (mPart) minutes = parseInt(mPart, 10);
      } catch {
        // Fallback to local
      }
    }

    const currentMinutes = hours * 60 + minutes;

    const [startH, startM] = quietHours.start.split(':').map(Number);
    const [endH, endM] = quietHours.end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Quiet hours do not span midnight (e.g. 13:00 to 15:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Quiet hours span midnight (e.g. 22:00 to 07:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * Adjusts a timestamp so that if it falls inside quiet hours,
   * it shifts to the exact end of quiet hours on the appropriate day.
   */
  static adjustForQuietHours(
    isoTimestamp: string,
    quietHours: QuietHours,
    timezone?: string,
  ): string {
    if (!this.isInsideQuietHours(isoTimestamp, quietHours, timezone)) {
      return isoTimestamp;
    }

    const date = new Date(isoTimestamp);
    const [endH, endM] = quietHours.end.split(':').map(Number);

    // If quiet hours span midnight and we're currently late at night (e.g. 23:00),
    // the end time is tomorrow at endH:endM.
    // If it's early morning (e.g. 05:00), the end time is today at endH:endM.
    const [startH] = quietHours.start.split(':').map(Number);
    const targetDate = new Date(date);

    if (startH > endH && date.getHours() >= startH) {
      // It's before midnight, end is tomorrow
      targetDate.setDate(targetDate.getDate() + 1);
    }
    targetDate.setHours(endH, endM, 0, 0);

    return targetDate.toISOString();
  }

  /**
   * Computes the next occurrence given a recurrence rule and the base trigger date.
   * Handles:
   * - Daily interval
   * - Weekly selected weekdays (e.g. Mon, Wed, Fri)
   * - Monthly with impossible date clamping (e.g. 31st clamped to Feb 28/29 or April 30)
   * - Yearly leap-year awareness
   * - Respects optional endDate and maxOccurrences
   */
  static getNextOccurrence(
    rule: RecurrenceRule,
    currentOccurrenceIso: string,
    nowIso: string,
  ): string | null {
    const current = new Date(currentOccurrenceIso);
    const now = new Date(nowIso);
    const interval = Math.max(1, rule.interval || 1);

    let next = new Date(current);

    switch (rule.frequency) {
      case 'DAILY': {
        do {
          next.setUTCDate(next.getUTCDate() + interval);
        } while (next.getTime() <= now.getTime());
        break;
      }

      case 'WEEKLY': {
        const daysOfWeek = rule.daysOfWeek && rule.daysOfWeek.length > 0
          ? [...rule.daysOfWeek].sort((a, b) => a - b)
          : [current.getUTCDay()];

        // Find the next matching weekday
        let found = false;
        let attempts = 0;
        const maxAttempts = 365;

        while (!found && attempts < maxAttempts) {
          attempts++;
          // Move forward 1 day
          next.setUTCDate(next.getUTCDate() + 1);

          // If we wrapped a full week, jump by interval - 1 weeks
          if (next.getUTCDay() === 0 && interval > 1) {
            next.setUTCDate(next.getUTCDate() + 7 * (interval - 1));
          }

          if (daysOfWeek.includes(next.getUTCDay()) && next.getTime() > now.getTime()) {
            found = true;
          }
        }
        if (!found) return null;
        break;
      }

      case 'MONTHLY': {
        const targetDay = rule.dayOfMonth || current.getUTCDate();
        do {
          // Increment month in UTC
          const targetMonth = next.getUTCMonth() + interval;
          const targetYear = next.getUTCFullYear() + Math.floor(targetMonth / 12);
          const normalizedMonth = ((targetMonth % 12) + 12) % 12;

          // Days in the target month (1-based index 0 is last day of previous month in UTC)
          const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();

          // CLAMP impossible dates (e.g. Feb 31 -> Feb 28 or 29, April 31 -> April 30)
          const clampedDay = Math.min(targetDay, daysInTargetMonth);

          next = new Date(
            Date.UTC(
              targetYear,
              normalizedMonth,
              clampedDay,
              current.getUTCHours(),
              current.getUTCMinutes(),
              current.getUTCSeconds(),
              current.getUTCMilliseconds(),
            ),
          );
        } while (next.getTime() <= now.getTime());
        break;
      }

      case 'YEARLY': {
        const originalMonth = current.getUTCMonth();
        const originalDay = current.getUTCDate();
        do {
          const nextYear = next.getUTCFullYear() + interval;
          // Handle Leap Day (Feb 29 on non-leap year -> Feb 28)
          const isLeapDay = originalMonth === 1 && originalDay === 29;
          const isNextLeapYear = (nextYear % 4 === 0 && nextYear % 100 !== 0) || nextYear % 400 === 0;
          const clampedDay = isLeapDay && !isNextLeapYear ? 28 : originalDay;

          next = new Date(
            Date.UTC(
              nextYear,
              originalMonth,
              clampedDay,
              current.getUTCHours(),
              current.getUTCMinutes(),
              current.getUTCSeconds(),
              current.getUTCMilliseconds(),
            ),
          );
        } while (next.getTime() <= now.getTime());
        break;
      }
    }

    // Check optional end date
    if (rule.endDate && next.toISOString() > rule.endDate) {
      return null;
    }

    return next.toISOString();
  }

  /**
   * Computes the next Nag Mode repeat trigger.
   * Returns null if repeatCount >= maxRepeats.
   */
  static getNextNagTrigger(
    currentTriggerIso: string,
    repeatCount: number,
    maxRepeats: number,
    nagIntervalMinutes: number = 15,
    quietHours?: QuietHours,
    timezone?: string,
  ): string | null {
    if (repeatCount >= maxRepeats) {
      return null;
    }

    const current = new Date(currentTriggerIso);
    const nextNag = new Date(current.getTime() + nagIntervalMinutes * 60 * 1000);
    let nextIso = nextNag.toISOString();

    if (quietHours && quietHours.enabled) {
      nextIso = this.adjustForQuietHours(nextIso, quietHours, timezone);
    }

    return nextIso;
  }
}
