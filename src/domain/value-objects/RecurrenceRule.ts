import { z } from 'zod';

export const RecurrenceFrequency = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type RecurrenceFrequency =
  (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

export const RecurrenceRuleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().int().min(1).max(365).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(), // 0=Sun, 6=Sat
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endDate: z.string().datetime().optional(),
  maxOccurrences: z.number().int().min(1).max(1000).optional(),
  timezone: z.string().min(1).optional(), // IANA timezone
});

export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;

export function validateRecurrenceRule(
  rule: unknown,
): { success: true; data: RecurrenceRule } | { success: false; error: string } {
  const result = RecurrenceRuleSchema.safeParse(rule);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join(', '),
    };
  }
  // Cross-field validation
  const data = result.data;
  if (
    data.frequency === 'WEEKLY' &&
    (!data.daysOfWeek || data.daysOfWeek.length === 0)
  ) {
    return {
      success: false,
      error: 'Weekly recurrence requires at least one day of week',
    };
  }
  if (
    data.frequency === 'MONTHLY' &&
    data.dayOfMonth !== undefined &&
    data.dayOfMonth > 28
  ) {
    // Allow but note: will need handling for short months in Phase 2
  }
  return { success: true, data };
}
