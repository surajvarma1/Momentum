import {
  toDateOnlyString,
  parseDateOnly,
  formatDisplayDate,
  formatDdMmYyyy,
  isDeadlineInPast,
  isTaskDateOverdue,
  normalizeDeadline,
} from '../../src/utils/dateUtils';

describe('DateUtils — Timezone-Safe Date Handling', () => {
  describe('Mandatory Calendar Dates Preservation', () => {
    const testCases = [
      { dateStr: '2026-11-01', expectedDdMmYyyy: '01-11-2026' },
      { dateStr: '2026-11-10', expectedDdMmYyyy: '10-11-2026' },
      { dateStr: '2026-11-11', expectedDdMmYyyy: '11-11-2026' },
      { dateStr: '2026-12-31', expectedDdMmYyyy: '31-12-2026' },
      { dateStr: '2027-01-01', expectedDdMmYyyy: '01-01-2027' },
    ];

    testCases.forEach(({ dateStr, expectedDdMmYyyy }) => {
      it(`preserves exactly ${dateStr} without shifting (${expectedDdMmYyyy})`, () => {
        // toDateOnlyString
        expect(toDateOnlyString(dateStr)).toBe(dateStr);

        // parseDateOnly
        const parsed = parseDateOnly(dateStr);
        expect(parsed.getFullYear()).toBe(parseInt(dateStr.split('-')[0], 10));
        expect(parsed.getMonth() + 1).toBe(parseInt(dateStr.split('-')[1], 10));
        expect(parsed.getDate()).toBe(parseInt(dateStr.split('-')[2], 10));

        // formatDdMmYyyy
        expect(formatDdMmYyyy(dateStr)).toBe(expectedDdMmYyyy);

        // formatDisplayDate
        const display = formatDisplayDate(dateStr, { includeWeekday: false });
        expect(display).toContain(String(parseInt(dateStr.split('-')[2], 10)));
        expect(display).toContain(dateStr.split('-')[0]);
      });
    });
  });

  describe('isDeadlineInPast', () => {
    const reference = '2026-11-10T12:00:00.000Z';

    it('considers today valid (not in past)', () => {
      expect(isDeadlineInPast('2026-11-10', reference)).toBe(false);
    });

    it('considers tomorrow valid', () => {
      expect(isDeadlineInPast('2026-11-11', reference)).toBe(false);
    });

    it('considers yesterday in the past', () => {
      expect(isDeadlineInPast('2026-11-09', reference)).toBe(true);
    });

    it('handles empty deadline as not in past', () => {
      expect(isDeadlineInPast('', reference)).toBe(false);
    });
  });

  describe('isTaskDateOverdue', () => {
    const now = '2026-11-10T16:00:00.000Z';

    it('task due today is NOT overdue while day is ongoing', () => {
      expect(isTaskDateOverdue('2026-11-10', 'PENDING', now)).toBe(false);
    });

    it('task due tomorrow is NOT overdue', () => {
      expect(isTaskDateOverdue('2026-11-11', 'PENDING', now)).toBe(false);
    });

    it('task due yesterday IS overdue if pending', () => {
      expect(isTaskDateOverdue('2026-11-09', 'PENDING', now)).toBe(true);
    });

    it('completed task is NEVER overdue', () => {
      expect(isTaskDateOverdue('2026-11-09', 'COMPLETED', now)).toBe(false);
    });

    it('cancelled task is NEVER overdue', () => {
      expect(isTaskDateOverdue('2026-11-09', 'CANCELLED', now)).toBe(false);
    });
  });

  describe('normalizeDeadline', () => {
    it('normalizes valid future date string', () => {
      expect(normalizeDeadline('2026-11-15')).toBe('2026-11-15');
    });

    it('calibrates past year to future fallback', () => {
      const fallbackDays = 2;
      const res = normalizeDeadline('2020-01-01', fallbackDays);
      const expected = new Date();
      expected.setDate(expected.getDate() + fallbackDays);
      expect(res).toBe(toDateOnlyString(expected));
    });
  });
});
