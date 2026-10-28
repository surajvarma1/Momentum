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

export interface AIProviderResult {
  rawJson: string;
  providerName: string;
  modelName: string;
}

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

    const userPrompt = `Goal: "${validatedInput.goalDescription}"
Target Timeline: Exactly ${totalDays} days.
Daily Focus Duration: ${sessionTime} minutes per session.
Timezone: ${validatedInput.timezone || 'UTC'}

Specialist Guidance:
${persona.instructions}

REQUIREMENTS:
1. Provide progressive daily-wise tasks covering all ${totalDays} days (Day 1: ..., Day 2: ..., through Day ${totalDays}: ...).
2. Each daily task MUST contain 3 to 5 practical, specific, actionable subtasks.
3. Organize tasks into milestones (m-1, m-2, etc.).
4. Calibrate intensity realistically for a ${sessionTime}-minute daily session.
5. Strictly return valid raw JSON only.`;

    const selectedProvider = validatedInput.provider || 'auto';

    // Provider execution list based on user preference or automatic failover
    const providerQueue = this.resolveProviderQueue(selectedProvider);
    const errorsEncountered: string[] = [];

    for (const provider of providerQueue) {
      try {
        let result: AIProviderResult | null = null;
        if (provider === 'openrouter') {
          result = await this.callOpenRouter(systemPrompt, userPrompt);
        } else if (provider === 'gemini') {
          result = await this.callGemini(systemPrompt, userPrompt);
        } else if (provider === 'nvidia') {
          result = await this.callNvidiaNIM(systemPrompt, userPrompt);
        } else if (provider === 'bytez') {
          result = await this.callBytez(systemPrompt, userPrompt);
        } else if (provider === 'supabase') {
          result = await this.callSupabaseEdge(validatedInput);
        }

        if (result && result.rawJson) {
          const cleaned = result.rawJson
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

          const parsedProposal = JSON.parse(cleaned);
          const sanitizedProposal = this.sanitizeProposal(parsedProposal);
          this.ensureSuggestedDeadlines(sanitizedProposal, dayDates);
          sanitizedProposal.providerUsed = `${result.providerName} (${result.modelName})`;
          return GoalDecompositionProposalSchema.parse(sanitizedProposal);
        }
      } catch (err: any) {
        errorsEncountered.push(`[${provider.toUpperCase()}]: ${err.message}`);
        console.warn(`Provider ${provider} failed: ${err.message}. Trying next available provider...`);
      }
    }

    // If all providers in the queue failed, throw the detailed aggregated error
    throw new Error(
      `AI Service Error:\n${errorsEncountered.join('\n') || 'No AI providers were able to process this request.'}`,
    );
  }

  private resolveProviderQueue(preference: string): Array<'openrouter' | 'gemini' | 'nvidia' | 'bytez' | 'supabase'> {
    if (preference !== 'auto') {
      return [preference as any];
    }

    const openRouterKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const nvidiaKey = process.env.EXPO_PUBLIC_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
    const bytezKey = process.env.EXPO_PUBLIC_BYTEZ_API_KEY || process.env.BYTEZ_API_KEY;

    const queue: Array<'openrouter' | 'gemini' | 'nvidia' | 'bytez' | 'supabase'> = [];

    // Prioritize providers that have configured API keys
    if (openRouterKey) queue.push('openrouter');
    if (geminiKey) queue.push('gemini');
    if (nvidiaKey) queue.push('nvidia');
    if (isSupabaseConfigured()) queue.push('supabase');
    if (bytezKey) queue.push('bytez');

    // Default cascade if none configured specifically
    if (queue.length === 0) {
      queue.push('openrouter', 'gemini', 'nvidia', 'bytez');
    }

    return queue;
  }

  // 1. OPENROUTER API
  async callOpenRouter(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
    const key = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    const model =
      process.env.EXPO_PUBLIC_OPENROUTER_MODEL ||
      process.env.OPENROUTER_MODEL ||
      'google/gemini-2.0-flash-exp:free';

    if (!key) {
      throw new Error('OPENROUTER_API_KEY not configured in .env');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://momentum.app',
        'X-Title': 'Momentum Todo App',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = errText;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.error?.message) msg = errObj.error.message;
      } catch {}
      throw new Error(`OpenRouter (${response.status}): ${msg}`);
    }

    const data = await response.json();
    const rawJson = data?.choices?.[0]?.message?.content || '';
    if (!rawJson) throw new Error('OpenRouter returned empty message content');

    return { rawJson, providerName: 'OpenRouter', modelName: model };
  }

  // 2. GOOGLE GEMINI API
  async callGemini(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
    const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const model =
      process.env.EXPO_PUBLIC_GEMINI_MODEL ||
      process.env.GEMINI_MODEL ||
      'gemini-1.5-flash';

    if (!key) {
      throw new Error('GEMINI_API_KEY not configured in .env');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = errText;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.error?.message) msg = errObj.error.message;
      } catch {}
      throw new Error(`Gemini (${response.status}): ${msg}`);
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawJson) throw new Error('Gemini returned empty content');

    return { rawJson, providerName: 'Google Gemini', modelName: model };
  }

  // 3. NVIDIA NIM API
  async callNvidiaNIM(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
    const key = process.env.EXPO_PUBLIC_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
    const model =
      process.env.EXPO_PUBLIC_NVIDIA_MODEL ||
      process.env.NVIDIA_MODEL ||
      'nvidia/llama-3.1-nemotron-70b-instruct';

    if (!key) {
      throw new Error('NVIDIA_API_KEY not configured in .env');
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = errText;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.error?.message) msg = errObj.error.message;
      } catch {}
      throw new Error(`NVIDIA NIM (${response.status}): ${msg}`);
    }

    const data = await response.json();
    const rawJson = data?.choices?.[0]?.message?.content || '';
    if (!rawJson) throw new Error('NVIDIA NIM returned empty content');

    return { rawJson, providerName: 'NVIDIA NIM', modelName: model };
  }

  // 4. BYTEZ API
  async callBytez(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
    const key =
      process.env.EXPO_PUBLIC_BYTEZ_API_KEY ||
      process.env.BYTEZ_API_KEY ||
      '0026a51ee9cb158a930840b63f2d19f5';
    const model =
      process.env.EXPO_PUBLIC_BYTEZ_MODEL ||
      process.env.BYTEZ_MODEL ||
      'Qwen/Qwen3-4B';

    if (!key) {
      throw new Error('BYTEZ_API_KEY not configured in .env');
    }

    let rawJson = '';
    let lastError = '';

    // Attempt A: Bytez OpenAI-compatible endpoint
    try {
      const response = await fetch('https://api.bytez.com/models/v2/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        rawJson = data?.choices?.[0]?.message?.content || '';
      } else {
        const errorText = await response.text();
        try {
          const errObj = JSON.parse(errorText);
          lastError = errObj.error || errorText;
        } catch {
          lastError = errorText;
        }
      }
    } catch (e: any) {
      lastError = e.message;
    }

    // Attempt B: Bytez Native Model endpoint
    if (!rawJson) {
      try {
        const response = await fetch(`https://api.bytez.com/models/v2/${model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${key}`,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            params: {
              max_new_tokens: 4096,
              temperature: 0.2,
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
          try {
            const errObj = JSON.parse(errorText);
            lastError = errObj.error || errorText;
          } catch {
            lastError = errorText;
          }
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!rawJson) {
      throw new Error(`Bytez: ${lastError || 'Model does not exist or has yet to be added to the Bytez catalog'}`);
    }

    return { rawJson, providerName: 'Bytez', modelName: model };
  }

  // 5. SUPABASE EDGE FUNCTION PROXY
  async callSupabaseEdge(validatedInput: DecomposeGoalInput): Promise<AIProviderResult | null> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase Edge Function timed out (>15s)')), 15000),
    );

    const invokePromise = this.client.functions.invoke('ai-decompose', {
      body: validatedInput,
    });

    const response: any = await Promise.race([invokePromise, timeoutPromise]);
    if (response.error) {
      throw new Error(response.error.message || 'Edge function returned non-2xx status code');
    }

    if (!response.data) return null;
    return {
      rawJson: JSON.stringify(response.data),
      providerName: 'Supabase Edge Proxy',
      modelName: 'Cloud AI',
    };
  }

  private ensureSuggestedDeadlines(proposal: any, dayDates: string[]): void {
    if (!Array.isArray(proposal.proposedTasks)) return;
    proposal.proposedTasks.forEach((task: any, index: number) => {
      if (!task.suggestedDeadline && dayDates[index]) {
        task.suggestedDeadline = dayDates[index];
      }
    });
  }

  calculateTimeline(
    goalDescription: string,
    deadline?: string | null,
  ): { totalDays: number; dayDates: string[] } {
    let days = 3;
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
        // Fallback
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
      providerUsed: raw.providerUsed ? String(raw.providerUsed) : undefined,
    };
  }
}
