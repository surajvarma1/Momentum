import { SupabaseClient } from '@supabase/supabase-js';
import { IAIDecomposerService } from '../../domain/ai/IAIDecomposerService';
import {
  DecomposeGoalInput,
  DecomposeGoalInputSchema,
  GoalDecompositionProposal,
  GoalDecompositionProposalSchema,
  sanitizeAIText,
} from '../../domain/ai/AIDecomposerTypes';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabaseClient';

export class SupabaseAIDecomposerService implements IAIDecomposerService {
  constructor(private client: SupabaseClient = getSupabaseClient()) {}

  async decomposeGoal(input: DecomposeGoalInput): Promise<GoalDecompositionProposal> {
    const validatedInput = DecomposeGoalInputSchema.parse(input);

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Configure the Supabase URL and anon key to use AI decomposition.');
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('AI request timed out (>15s)')), 15000);
      });

      const invokePromise = this.client.functions.invoke('ai-decompose', {
        body: validatedInput,
      });
      const response = await Promise.race([invokePromise, timeoutPromise]);

      if (response.error) {
        let errorMessage = response.error.message || 'AI Goal Decomposition failed';
        const errorResponse = response.error.context;
        if (errorResponse && typeof errorResponse.clone === 'function') {
          try {
            const errorBody = await errorResponse.clone().json();
            if (typeof errorBody?.error === 'string') {
              errorMessage = typeof errorBody.details === 'string'
                ? `${errorBody.error}: ${errorBody.details}`
                : errorBody.error;
            }
          } catch {
            // Use the Supabase error message if the response body isn't JSON.
          }
        }
        throw new Error(errorMessage);
      }

      if (!response.data) {
        throw new Error('Received empty response from AI decomposition service');
      }

      const sanitizedProposal = this.sanitizeProposal(response.data);
      this.ensureSuggestedDeadlines(sanitizedProposal, validatedInput);
      return GoalDecompositionProposalSchema.parse(sanitizedProposal);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private ensureSuggestedDeadlines(
    proposal: { proposedTasks?: { suggestedDeadline: string | null }[] },
    input: DecomposeGoalInput,
  ): void {
    const tasks = proposal.proposedTasks;
    if (!Array.isArray(tasks)) return;

    const baseDate = input.deadline ? new Date(input.deadline) : new Date();
    const totalDays = input.deadline
      ? Math.min(30, Math.max(1, Math.ceil((baseDate.getTime() - Date.now()) / 86400000)))
      : 3;

    tasks.forEach((task, index) => {
      if (task.suggestedDeadline) return;
      const date = new Date();
      date.setDate(date.getDate() + Math.ceil(((index + 1) * totalDays) / tasks.length));
      date.setHours(23, 59, 59, 0);
      task.suggestedDeadline = date.toISOString();
    });
  }

  private sanitizeProposal(raw: any): any {
    return {
      goalSummary: sanitizeAIText(raw.goalSummary || ''),
      milestones: (raw.milestones || []).map((milestone: any) => ({
        id: String(milestone.id || 'm-1'),
        title: sanitizeAIText(milestone.title || ''),
        description: milestone.description ? sanitizeAIText(milestone.description) : null,
        order: Number(milestone.order || 1),
      })),
      proposedTasks: (raw.proposedTasks || []).map((task: any) => ({
        title: sanitizeAIText(task.title || ''),
        description: task.description ? sanitizeAIText(task.description) : null,
        priority: task.priority || 'MEDIUM',
        energyLevel: task.energyLevel || 'MEDIUM',
        estimatedDurationMinutes: Number(task.estimatedDurationMinutes || 25),
        suggestedDeadline: task.suggestedDeadline || null,
        milestoneId: task.milestoneId || null,
        subtasks: (task.subtasks || []).map((subtask: string) => sanitizeAIText(subtask)),
      })),
      assumptions: (raw.assumptions || []).map((assumption: string) => sanitizeAIText(assumption)),
    };
  }
}
