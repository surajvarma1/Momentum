/**
 * Centralized, timezone-safe date utility for Momentum.
 *
 * Distinguishes between:
 * 1. Date-only values: deadlines, calendar dates (format: YYYY-MM-DD).
 * 2. Date-time values: reminders, scheduled notifications.
 * 3. Timestamps: createdAt, updatedAt, completedAt (ISO 8601 UTC).
 *
 * Guarantees that selected calendar dates (e.g. 10-11-2026) never shift forward
 * or backward regardless of device timezone (UTC-12 to UTC+14).
 */

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns a date-only string in YYYY-MM-DD format using local calendar components.
 * Never shifts by timezone.
 */
export function toDateOnlyString(input?: Date | string | number | null): string {
  if (!input) {
    const now = new Date();
    return formatLocalYmd(now);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // If already in YYYY-MM-DD format, return directly without Date parsing
    if (DATE_ONLY_REGEX.test(trimmed)) {
      return trimmed;
    }
    // If it contains a T separator, extract the date part directly if clean
    if (trimmed.includes('T')) {
      const parts = trimmed.split('T');
      if (DATE_ONLY_REGEX.test(parts[0])) {
        // If it was stored as local or with timezone, parse safely
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return formatLocalYmd(parsed);
        }
        return parts[0];
      }
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return formatLocalYmd(parsed);
    }
    return trimmed.slice(0, 10);
  }

  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    return formatLocalYmd(new Date());
  }
  return formatLocalYmd(d);
}

function formatLocalYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD date-only string into a local Date object set to 00:00:00 local time.
 * Avoids the standard `new Date("YYYY-MM-DD")` UTC midnight trap.
 */
export function parseDateOnly(dateStr: string): Date {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;

  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Format a date-only value (YYYY-MM-DD or Date) for presentation.
 * Example: "Tue, Nov 10, 2026" or "Nov 10, 2026"
 */
export function formatDisplayDate(
  input: string | Date | null | undefined,
  options: { includeWeekday?: boolean; monthFormat?: 'short' | 'long' } = { includeWeekday: true, monthFormat: 'short' },
): string {
  if (!input) return '';

  const dateObj = typeof input === 'string' ? parseDateOnly(input) : input;
  if (isNaN(dateObj.getTime())) return String(input);

  const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const year = dateObj.getFullYear();
  const monthIdx = dateObj.getMonth();
  const day = dateObj.getDate();
  const weekday = WEEKDAYS[dateObj.getDay()];
  const monthName = options.monthFormat === 'long' ? MONTH_NAMES_LONG[monthIdx] : MONTH_NAMES_SHORT[monthIdx];

  if (options.includeWeekday) {
    return `${weekday}, ${monthName} ${day}, ${year}`;
  }
  return `${monthName} ${day}, ${year}`;
}

/**
 * Format in DD-MM-YYYY format for numeric display if needed.
 */
export function formatDdMmYyyy(input: string | Date | null | undefined): string {
  if (!input) return '';
  const dateStr = toDateOnlyString(input);
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

/**
 * Checks whether a given deadline date-only string is in the past relative to referenceDate.
 * A task due TODAY is NOT in the past (it remains valid until the end of the day).
 */
export function isDeadlineInPast(deadlineStr: string, referenceDate: Date | string = new Date()): boolean {
  if (!deadlineStr) return false;
  const deadlineYmd = toDateOnlyString(deadlineStr);
  const referenceYmd = toDateOnlyString(referenceDate);
  return deadlineYmd < referenceYmd;
}

/**
 * Checks if a task is overdue given its deadline and the current reference timestamp.
 * A task with a date-only deadline YYYY-MM-DD is overdue only once the current local date
 * is strictly greater than the deadline date.
 */
export function isTaskDateOverdue(
  deadline: string | null | undefined,
  status: string,
  nowTimestamp: string = new Date().toISOString(),
): boolean {
  if (!deadline) return false;
  if (status === 'COMPLETED' || status === 'CANCELLED') return false;

  const deadlineYmd = toDateOnlyString(deadline);
  const nowYmd = toDateOnlyString(nowTimestamp);
  return deadlineYmd < nowYmd;
}

/**
 * Normalizes any deadline input (date-only, full ISO, etc.) to a consistent YYYY-MM-DD date-only string.
 */
export function normalizeDeadline(raw: any, fallbackDaysFromNow: number = 0): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const ymd = toDateOnlyString(raw.trim());
    if (DATE_ONLY_REGEX.test(ymd)) {
      const year = parseInt(ymd.split('-')[0], 10);
      const currentYear = new Date().getFullYear();
      if (year >= currentYear) {
        return ymd;
      }
    }
  }

  const d = new Date();
  d.setDate(d.getDate() + fallbackDaysFromNow);
  return toDateOnlyString(d);
}
