import { z } from 'zod';

export const DecomposeGoalInputSchema = z.object({
  goalDescription: z
    .string()
    .trim()
    .min(5, 'Goal description must be at least 5 characters')
    .max(500, 'Goal description must not exceed 500 characters'),
  deadline: z.string().nullable().optional(),
  availableTimeBudgetMinutes: z
    .number()
    .int()
    .min(15, 'Time budget must be at least 15 minutes')
    .max(10080, 'Time budget cannot exceed 7 days (10080 minutes)')
    .optional(),
  preferredSessionMinutes: z
    .number()
    .int()
    .min(15, 'Session duration must be at least 15 minutes')
    .max(240, 'Session duration cannot exceed 240 minutes')
    .default(25),
  includeExistingCommitments: z.boolean().default(false),
  timezone: z.string().default('UTC'),
  provider: z.enum(['auto', 'openrouter', 'gemini', 'nvidia', 'bytez']).optional().default('auto'),
});

export type DecomposeGoalInput = z.input<typeof DecomposeGoalInputSchema>;

export const ProposedSubtaskSchema = z.string().trim().min(1).max(100);

export const ProposedTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required')
    .max(200, 'Task title must not exceed 200 characters'),
  description: z.string().trim().max(500).optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'IMPORTANT']).default('MEDIUM'),
  energyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  estimatedDurationMinutes: z
    .number()
    .int()
    .min(5, 'Duration must be at least 5 minutes')
    .max(480, 'Duration cannot exceed 8 hours (480 minutes)'),
  suggestedDeadline: z.string().nullable().optional(),
  milestoneId: z.string().optional().nullable(),
  subtasks: z.array(ProposedSubtaskSchema).max(5).default([]),
});

export type ProposedTask = z.infer<typeof ProposedTaskSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).optional().nullable(),
  order: z.number().int(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

export const GoalDecompositionProposalSchema = z.object({
  goalSummary: z.string().trim().min(1).max(300),
  milestones: z.array(MilestoneSchema).max(10).default([]),
  proposedTasks: z
    .array(ProposedTaskSchema)
    .min(1, 'At least 1 task must be proposed')
    .max(35, 'Cannot exceed 35 tasks per decomposition'),
  assumptions: z.array(z.string().trim().max(200)).max(8).default([]),
  providerUsed: z.string().optional(),
});

export type GoalDecompositionProposal = z.infer<typeof GoalDecompositionProposalSchema>;

/**
 * Sanitizes AI-generated text to ensure no executable shell, SQL, or arbitrary URLs
 * can be embedded into generated tasks.
 */
export function sanitizeAIText(text: string): string {
  if (!text) return '';
  return text
    // Strip <script>...</script> tags and interior contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip other HTML tags
    .replace(/<[^>]*>?/gm, '')
    // Strip shell command markers or SQL delimiters
    .replace(/(`|\$|\bexec\b|\bdrop\b|\bdelete\s+from\b|--|;)/gi, '')
    // Strip direct arbitrary URLs
    .replace(/https?:\/\/[^\s]+/g, '[url-removed]')
    .trim();
}
