import { z } from 'zod';
import { Task, CreateTaskInput, UpdateTaskInput } from '../entities/Task';
import { canTransition, TaskStatus } from '../value-objects/TaskStatus';
import { RecurrenceRuleSchema } from '../value-objects/RecurrenceRule';

const TrimmedNonEmpty = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'Must not be blank'));

const CreateTaskInputSchema = z.object({
  title: TrimmedNonEmpty.pipe(
    z.string().max(500, 'Title must be at most 500 characters'),
  ),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .nullable()
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'IMPORTANT']).optional(),
  energyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  estimatedDurationMinutes: z
    .number()
    .int('Estimated duration must be a whole number')
    .min(1, 'Estimated duration must be at least 1 minute')
    .max(1440, 'Estimated duration must be at most 1440 minutes (24 hours)')
    .nullable()
    .optional(),
  deadline: z.string().datetime({ message: 'Deadline must be a valid ISO 8601 date' }).nullable().optional(),
  deadlineTimezone: z.string().min(1).nullable().optional(),
  tags: z
    .array(
      z
        .string()
        .min(1, 'Tag must not be empty')
        .max(50, 'Tag must be at most 50 characters'),
    )
    .max(20, 'At most 20 tags allowed')
    .optional(),
  subtasks: z
    .array(
      z.object({
        title: TrimmedNonEmpty.pipe(
          z.string().max(500, 'Subtask title must be at most 500 characters'),
        ),
        sortOrder: z.number().int().optional(),
      }),
    )
    .max(100, 'At most 100 subtasks allowed')
    .optional(),
  recurrenceRule: RecurrenceRuleSchema.nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const UpdateTaskInputSchema = z.object({
  title: TrimmedNonEmpty.pipe(
    z.string().max(500, 'Title must be at most 500 characters'),
  ).optional(),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .nullable()
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'IMPORTANT']).optional(),
  energyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  estimatedDurationMinutes: z
    .number()
    .int('Estimated duration must be a whole number')
    .min(1, 'Estimated duration must be at least 1 minute')
    .max(1440, 'Estimated duration must be at most 1440 minutes (24 hours)')
    .nullable()
    .optional(),
  deadline: z.string().datetime({ message: 'Deadline must be a valid ISO 8601 date' }).nullable().optional(),
  deadlineTimezone: z.string().min(1).nullable().optional(),
  tags: z
    .array(
      z
        .string()
        .min(1, 'Tag must not be empty')
        .max(50, 'Tag must be at most 50 characters'),
    )
    .max(20, 'At most 20 tags allowed')
    .optional(),
  recurrenceRule: RecurrenceRuleSchema.nullable().optional(),
  sortOrder: z.number().int().optional(),
});

type ValidatedCreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
type ValidatedUpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export function validateCreateTaskInput(
  input: unknown,
  now: string,
):
  | { success: true; data: ValidatedCreateTaskInput }
  | { success: false; errors: string[] } {
  const result = CreateTaskInputSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }

  const errors: string[] = [];
  const data = result.data;

  // Deadline must be in the future for new tasks
  if (data.deadline && data.deadline <= now) {
    errors.push('Deadline must be in the future');
  }

  // Cross-field: weekly recurrence needs daysOfWeek
  if (data.recurrenceRule) {
    if (
      data.recurrenceRule.frequency === 'WEEKLY' &&
      (!data.recurrenceRule.daysOfWeek ||
        data.recurrenceRule.daysOfWeek.length === 0)
    ) {
      errors.push('Weekly recurrence requires at least one day of week');
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data };
}

export function validateUpdateTaskInput(
  input: unknown,
  existingTask: Task,
  now: string,
):
  | { success: true; data: ValidatedUpdateTaskInput }
  | { success: false; errors: string[] } {
  const result = UpdateTaskInputSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }

  const errors: string[] = [];
  const data = result.data;

  // If setting a new deadline, it must be in the future
  if (data.deadline !== undefined && data.deadline !== null && data.deadline <= now) {
    errors.push('Deadline must be in the future');
  }

  // Cross-field: weekly recurrence needs daysOfWeek
  if (data.recurrenceRule) {
    if (
      data.recurrenceRule.frequency === 'WEEKLY' &&
      (!data.recurrenceRule.daysOfWeek ||
        data.recurrenceRule.daysOfWeek.length === 0)
    ) {
      errors.push('Weekly recurrence requires at least one day of week');
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data };
}

export function validateStatusTransition(
  from: TaskStatus,
  to: TaskStatus,
): { success: true } | { success: false; error: string } {
  if (!canTransition(from, to)) {
    return {
      success: false,
      error: `Cannot transition from ${from} to ${to}`,
    };
  }
  return { success: true };
}
