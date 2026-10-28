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
    // 1. Validate Input Schema
    const validatedInput = DecomposeGoalInputSchema.parse(input);

    // 2. Timeline and Domain Persona calculation
    const { totalDays, dayDates } = this.calculateTimeline(
      validatedInput.goalDescription,
      validatedInput.deadline,
    );
    const persona = this.detectGoalPersona(validatedInput.goalDescription);
    const sessionTime = validatedInput.preferredSessionMinutes || 25;

    // 3. If Supabase is configured, attempt backend Edge Function first
    if (isSupabaseConfigured()) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AI request timed out (>15s)')), 15000);
        });

        const invokePromise = this.client.functions.invoke('ai-decompose', {
          body: validatedInput,
        });

        const response: any = await Promise.race([invokePromise, timeoutPromise]);

        if (response.error) {
          let errorMessage = response.error.message || 'Edge Function returned a non-2xx status code';
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
              try {
                const text = await errorResponse.clone().text();
                if (text) errorMessage = text;
              } catch {
                // Keep default
              }
            }
          }
          console.warn('Backend Supabase AI function unavailable (' + errorMessage + '), connecting directly to Bytez AI...');
        } else if (response.data) {
          const sanitizedProposal = this.sanitizeProposal(response.data);
          this.ensureSuggestedDeadlines(sanitizedProposal, dayDates);
          return GoalDecompositionProposalSchema.parse(sanitizedProposal);
        }
      } catch (err: any) {
        console.warn('Supabase Edge Function invocation failed (' + err.message + '), connecting directly to Bytez AI...');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    // 4. Direct Bytez AI Model Connection (pure AI model generation, zero mock data)
    return this.callBytezAI(validatedInput, persona, totalDays, dayDates, sessionTime);
  }

  private async callBytezAI(
    input: DecomposeGoalInput,
    persona: { role: string; instructions: string },
    totalDays: number,
    dayDates: string[],
    sessionTime: number,
  ): Promise<GoalDecompositionProposal> {
    const apiKey =
      process.env.EXPO_PUBLIC_BYTEZ_API_KEY ||
      process.env.BYTEZ_API_KEY ||
      '0026a51ee9cb158a930840b63f2d19f5';

    const model =
      process.env.EXPO_PUBLIC_BYTEZ_MODEL ||
      process.env.BYTEZ_MODEL ||
      'Qwen/Qwen3-4B';

    if (!apiKey) {
      throw new Error(
        'AI Goal Decomposer requires BYTEZ_API_KEY to be configured. Mock data is disabled in this application.',
      );
    }

    const systemPrompt = `You are a ${persona.role}. You are an elite AI task decomposition agent.
You MUST output ONLY a valid JSON object matching the exact schema requested without markdown code fences or conversation.
Your response must strictly conform to:
{
  "goalSummary": string,
  "milestones": [
    { "id": "m-1", "title": string, "description": string, "order": 1 }
  ],
  "proposedTasks": [
    {
      "title": "Day 1: [Task title]",
      "description": string,
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "energyLevel": "HIGH" | "MEDIUM" | "LOW",
      "estimatedDurationMinutes": number,
      "suggestedDeadline": string,
      "milestoneId": "m-1",
      "subtasks": ["Subtask 1", "Subtask 2", "Subtask 3"]
    }
  ],
  "assumptions": [string]
}`;

    const userPrompt = `Goal: "${input.goalDescription}"
Target Timeline: Exactly ${totalDays} days.
Daily Focus Duration: ${sessionTime} minutes per session.
Timezone: ${input.timezone || 'UTC'}

Specialist Guidance:
${persona.instructions}

REQUIREMENTS:
1. Provide progressive daily-wise tasks covering all ${totalDays} days (Day 1: ..., Day 2: ..., through Day ${totalDays}: ...).
2. Each daily task MUST contain 3 to 5 practical, specific, actionable subtasks.
3. Organize tasks into milestones (m-1, m-2, etc.).
4. Calibrate intensity realistically for a ${sessionTime}-minute daily session.
5. Strictly return valid raw JSON only.`;

    let rawJson = '';
    let lastError = '';

    // Attempt 1: Bytez OpenAI-compatible endpoint
    try {
      const response = await fetch('https://api.bytez.com/models/v2/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        rawJson = data?.choices?.[0]?.message?.content || '';
      } else {
        const errorText = await response.text();
        let parsed = errorText;
        try {
          const errObj = JSON.parse(errorText);
          if (errObj.error) parsed = errObj.error;
        } catch {
          // Keep raw
        }
        lastError = parsed;
      }
    } catch (e: any) {
      lastError = e.message;
    }

    // Attempt 2: Bytez Native Model endpoint
    if (!rawJson) {
      try {
        const response = await fetch(`https://api.bytez.com/models/v2/${model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${apiKey}`,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            params: {
              max_new_tokens: 4096,
              temperature: 0.3,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          rawJson =
            data?.output?.content?.[0]?.text ||
            (typeof data?.output === 'string' ? data.output : JSON.stringify(data?.output || ''));
        } else {
          const errorText = await response.text();
          let parsedError = errorText;
          try {
            const errObj = JSON.parse(errorText);
            if (errObj.error) parsedError = errObj.error;
          } catch {
            // Keep raw
          }
          lastError = parsedError;
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!rawJson) {
      // NEVER RETURN MOCK DATA. Surface the actual error from the AI model service.
      throw new Error(`AI Model Service Error: ${lastError || 'Unable to connect to Bytez AI.'}`);
    }

    const cleaned = rawJson
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsedProposal: any;
    try {
      parsedProposal = JSON.parse(cleaned);
    } catch (parseErr: any) {
      throw new Error(`AI Model returned invalid JSON: ${parseErr.message}`);
    }

    const sanitizedProposal = this.sanitizeProposal(parsedProposal);
    this.ensureSuggestedDeadlines(sanitizedProposal, dayDates);
    return GoalDecompositionProposalSchema.parse(sanitizedProposal);
  }

  private ensureSuggestedDeadlines(proposal: any, dayDates: string[]): void {
    if (!Array.isArray(proposal.proposedTasks)) return;
    proposal.proposedTasks.forEach((task: any, index: number) => {
      if (!task.suggestedDeadline && dayDates[index]) {
        task.suggestedDeadline = dayDates[index];
      }
    });
  }

  /**
   * Calculates the timeline span and assigns daily calendar dates starting from today.
   */
  calculateTimeline(
    goalDescription: string,
    deadline?: string | null,
  ): { totalDays: number; dayDates: string[] } {
    let days = 3; // Default 3 milestone tasks when no timeline or deadline is specified
    const now = new Date();

    const dayMatch = goalDescription.match(/(?:in|for|within)?\s*(\d+)\s*(?:days?|day)/i);
    const weekMatch = goalDescription.match(/(?:in|for|within)?\s*(\d+)\s*(?:weeks?|week)/i);
    const monthMatch = goalDescription.match(/(?:in|for|within)?\s*(\d+)\s*(?:months?|month)/i);

    if (deadline) {
      try {
        const target = new Date(deadline);
        if (!isNaN(target.getTime())) {
          const diffMs = target.getTime() - now.getTime();
          const calculated = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (calculated > 0) {
            days = Math.min(30, Math.max(1, calculated));
          }
        }
      } catch {
        // Fallback to text parsing
      }
    } else if (dayMatch && dayMatch[1]) {
      days = Math.min(30, Math.max(1, parseInt(dayMatch[1], 10)));
    } else if (weekMatch && weekMatch[1]) {
      days = Math.min(30, Math.max(1, parseInt(weekMatch[1], 10) * 7));
    } else if (monthMatch && monthMatch[1]) {
      days = Math.min(30, Math.max(1, parseInt(monthMatch[1], 10) * 30));
    }

    const dayDates: string[] = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      d.setHours(23, 59, 59, 0);
      dayDates.push(d.toISOString());
    }

    return { totalDays: days, dayDates };
  }

  /**
   * Detects goal category to adopt the appropriate domain expert persona.
   */
  detectGoalPersona(goal: string): {
    role: string;
    instructions: string;
    category: 'fitness' | 'coding' | 'learning' | 'general';
  } {
    const text = goal.toLowerCase();
    if (
      text.includes('body') ||
      text.includes('gym') ||
      text.includes('workout') ||
      text.includes('muscle') ||
      text.includes('weight') ||
      text.includes('fat') ||
      text.includes('chest') ||
      text.includes('fitness') ||
      text.includes('exercise') ||
      text.includes('diet') ||
      text.includes('pushup')
    ) {
      return {
        role: 'Certified Elite Personal Fitness Trainer & Strength Coach',
        instructions:
          'Act as a strict, knowledgeable fitness coach. Structure a day-by-day training split (Push, Pull, Legs, Core, Cardio, Active Recovery/Rest) calibrated for the timeframe. Include specific exercises with exact sets and reps as subtasks for every single day.',
        category: 'fitness',
      };
    }

    if (
      text.includes('code') ||
      text.includes('app') ||
      text.includes('software') ||
      text.includes('build') ||
      text.includes('website') ||
      text.includes('frontend') ||
      text.includes('backend') ||
      text.includes('fullstack') ||
      text.includes('react') ||
      text.includes('python') ||
      text.includes('api') ||
      text.includes('dev')
    ) {
      return {
        role: 'Senior Engineering Manager & Technical Project Lead',
        instructions:
          'Act as a senior tech lead. Structure an agile day-by-day development roadmap (architecture, database models, core APIs, UI screens, state management, testing, and deployment). Each day must have 3-5 concrete technical deliverables as subtasks.',
        category: 'coding',
      };
    }

    if (
      text.includes('study') ||
      text.includes('exam') ||
      text.includes('learn') ||
      text.includes('course') ||
      text.includes('book') ||
      text.includes('read') ||
      text.includes('certification')
    ) {
      return {
        role: 'Master Academic Advisor & Accelerated Learning Strategist',
        instructions:
          'Act as a master tutor. Structure a progressive day-by-day curriculum with foundational concepts, practice drills, active recall reviews, and practice assessments leading to the target deadline.',
        category: 'learning',
      };
    }

    return {
      role: 'Executive Strategic Productivity Coach',
      instructions:
        'Act as an expert productivity strategist. Decompose this goal into progressive, day-by-day execution blocks calibrated to the deadline.',
      category: 'general',
    };
  }

  private sanitizeProposal(raw: any): any {
    return {
      goalSummary: sanitizeAIText(raw.goalSummary || ''),
      milestones: (raw.milestones || []).map((m: any) => ({
        id: String(m.id || 'm-1'),
        title: sanitizeAIText(m.title || ''),
        description: m.description ? sanitizeAIText(m.description) : null,
        order: Number(m.order || 1),
      })),
      proposedTasks: (raw.proposedTasks || []).map((t: any) => ({
        title: sanitizeAIText(t.title || ''),
        description: t.description ? sanitizeAIText(t.description) : null,
        priority: t.priority || 'MEDIUM',
        energyLevel: t.energyLevel || 'MEDIUM',
        estimatedDurationMinutes: Number(t.estimatedDurationMinutes || 25),
        suggestedDeadline: t.suggestedDeadline || null,
        milestoneId: t.milestoneId || null,
        subtasks: (t.subtasks || []).map((s: string) => sanitizeAIText(s)),
      })),
      assumptions: (raw.assumptions || []).map((a: string) => sanitizeAIText(a)),
    };
  }
}
