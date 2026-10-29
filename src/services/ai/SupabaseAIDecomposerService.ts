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
          const parsedProposal = this.extractJson(result.rawJson);
          const sanitizedProposal = this.sanitizeProposal(parsedProposal, dayDates);
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

    const nvidiaKey = process.env.EXPO_PUBLIC_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
    const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    const bytezKey = process.env.EXPO_PUBLIC_BYTEZ_API_KEY || process.env.BYTEZ_API_KEY;

    const queue: Array<'openrouter' | 'gemini' | 'nvidia' | 'bytez' | 'supabase'> = [];

    // Prioritize providers that have configured API keys (NVIDIA NIM first as high performance model)
    if (nvidiaKey) queue.push('nvidia');
    if (geminiKey) queue.push('gemini');
    if (openRouterKey) queue.push('openrouter');
    if (bytezKey) queue.push('bytez');
    if (isSupabaseConfigured()) queue.push('supabase');

    // Default cascade if none configured specifically
    if (queue.length === 0) {
      queue.push('nvidia', 'gemini', 'openrouter', 'bytez');
    }

    return queue;
  }

  // 1. OPENROUTER API
  async callOpenRouter(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
    const key = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    const configuredModel =
      process.env.EXPO_PUBLIC_OPENROUTER_MODEL ||
      process.env.OPENROUTER_MODEL ||
      'cohere/north-mini-code:free';

    if (!key) {
      throw new Error('OPENROUTER_API_KEY not configured in .env');
    }

    const candidateModels = [
      configuredModel,
      'cohere/north-mini-code:free',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'nvidia/nemotron-3.5-super-vl:free',
      'liquid/lfm-2.5-2.6b:free',
      'recursive/flint-v1.0:free',
    ];
    const modelsToTry = [...new Set(candidateModels.filter(Boolean))];

    let lastError = '';

    for (const currentModel of modelsToTry) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'https://momentum.app',
            'X-Title': 'Momentum Todo App',
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              { role: 'system', content: `${systemPrompt}\nStrictly output valid raw JSON only, no markdown code blocks, no conversation.` },
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
          lastError = `OpenRouter (${response.status}) on ${currentModel}: ${msg}`;
          console.warn(`[OpenRouter] Model ${currentModel} returned ${response.status}: ${msg}. Trying next candidate model...`);
          continue;
        }

        const data = await response.json();
        const choice = data?.choices?.[0];
        let rawJson = choice?.message?.content || '';
        if (!rawJson.trim()) {
          rawJson = choice?.message?.reasoning || choice?.message?.reasoning_content || '';
        }

        if (!rawJson.trim()) {
          lastError = `OpenRouter (${currentModel}): Empty message content`;
          console.warn(`[OpenRouter] Model ${currentModel} returned empty content. Trying next candidate model...`);
          continue;
        }

        // Validate JSON can be parsed
        try {
          this.extractJson(rawJson);
          return { rawJson, providerName: 'OpenRouter', modelName: currentModel };
        } catch (parseErr: any) {
          lastError = `OpenRouter (${currentModel}): Failed to parse JSON: ${parseErr.message}`;
          console.warn(`[OpenRouter] Model ${currentModel} output invalid JSON. Trying next candidate model...`);
          continue;
        }
      } catch (err: any) {
        lastError = `OpenRouter (${currentModel}): ${err.message}`;
        console.warn(`[OpenRouter] Model ${currentModel} network error: ${err.message}. Trying next candidate model...`);
      }
    }

    throw new Error(lastError || 'OpenRouter all candidate free models failed');
  }

  // 2. GOOGLE GEMINI API
  async callGemini(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
    const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const configuredModel =
      process.env.EXPO_PUBLIC_GEMINI_MODEL ||
      process.env.GEMINI_MODEL ||
      'gemini-flash-lite-latest';

    if (!key) {
      throw new Error('GEMINI_API_KEY not configured in .env');
    }

    const candidateModels = [
      configuredModel,
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];
    const modelsToTry = [...new Set(candidateModels.filter(Boolean))];

    let lastError = '';
    for (const currentModel of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${key}`;
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
          lastError = `Gemini (${response.status}) on ${currentModel}: ${msg}`;
          console.warn(`[Gemini] Model ${currentModel} returned ${response.status}: ${msg}. Trying next candidate model...`);
          continue;
        }

        const data = await response.json();
        const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawJson) {
          try {
            this.extractJson(rawJson);
            return { rawJson, providerName: 'Google Gemini', modelName: currentModel };
          } catch (parseErr: any) {
            lastError = `Gemini (${currentModel}): Failed to parse JSON: ${parseErr.message}`;
            continue;
          }
        }
      } catch (e: any) {
        lastError = `Gemini (${currentModel}): ${e.message}`;
      }
    }

    throw new Error(lastError || 'Gemini returned empty content');
  }

  // 3. NVIDIA NIM API
  async callNvidiaNIM(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
    const key = process.env.EXPO_PUBLIC_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
    const model =
      process.env.EXPO_PUBLIC_NVIDIA_MODEL ||
      process.env.NVIDIA_MODEL ||
      'nvidia/nemotron-3.5-super-vl-120b-a12b';

    if (!key) {
      throw new Error('NVIDIA_API_KEY not configured in .env (ensure EXPO_PUBLIC_NVIDIA_API_KEY is set)');
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
      signal: AbortSignal.timeout(60000),
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
    const message = data?.choices?.[0]?.message;
    const rawJson = message?.content || message?.reasoning_content || message?.reasoning || '';
    if (!rawJson) throw new Error('NVIDIA NIM returned empty content');

    // Pre-validate JSON extraction
    this.extractJson(rawJson);

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

    const modelsToTry = [model];
    if (model.includes('Qwen3') || model.includes('qwen3')) {
      modelsToTry.push('Qwen/Qwen2.5-7B-Instruct', 'google/gemma-2-2b-it');
    }

    let rawJson = '';
    let lastError = '';

    for (const currentModel of modelsToTry) {
      // Attempt A: Bytez OpenAI-compatible endpoint
      try {
        const response = await fetch('https://api.bytez.com/models/v2/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: currentModel,
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
          if (rawJson) return { rawJson, providerName: 'Bytez', modelName: currentModel };
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
      try {
        const response = await fetch(`https://api.bytez.com/models/v2/${currentModel}`, {
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
          if (rawJson) return { rawJson, providerName: 'Bytez', modelName: currentModel };
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

  private extractJson(rawText: string): any {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonSubstring = cleaned.slice(firstBrace, lastBrace + 1);
        return JSON.parse(jsonSubstring);
      }
      throw new Error(`AI Model returned invalid JSON formatting`);
    }
  }

  private normalizeDeadline(val: any, fallback?: string): string | null {
    if (typeof val === 'string' && val.trim().length > 0) {
      const trimmed = val.trim();
      const ts = Date.parse(trimmed);
      if (!isNaN(ts)) {
        return new Date(ts).toISOString();
      }
    }
    if (fallback) {
      const fbTs = Date.parse(fallback);
      if (!isNaN(fbTs)) {
        return new Date(fbTs).toISOString();
      }
    }
    return null;
  }

  private normalizePriority(val: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'IMPORTANT' {
    if (typeof val === 'string') {
      const u = val.toUpperCase().trim();
      if (u === 'LOW' || u === 'MEDIUM' || u === 'HIGH' || u === 'IMPORTANT') return u;
      if (u.includes('URGENT') || u.includes('CRITICAL')) return 'HIGH';
    }
    return 'MEDIUM';
  }

  private normalizeEnergy(val: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (typeof val === 'string') {
      const u = val.toUpperCase().trim();
      if (u === 'LOW' || u === 'MEDIUM' || u === 'HIGH') return u;
    }
    return 'MEDIUM';
  }

  private normalizeSubtasks(rawSubtasks: any): string[] {
    if (!Array.isArray(rawSubtasks)) return [];
    return rawSubtasks
      .map((st: any) => {
        const text = typeof st === 'string' ? st : (st?.title || st?.name || String(st || ''));
        return sanitizeAIText(text).slice(0, 100).trim();
      })
      .filter((s: string) => s.length > 0)
      .slice(0, 5);
  }

  private ensureSuggestedDeadlines(proposal: any, dayDates: string[]): void {
    if (!Array.isArray(proposal.proposedTasks)) return;
    proposal.proposedTasks.forEach((task: any, index: number) => {
      task.suggestedDeadline = this.normalizeDeadline(task.suggestedDeadline, dayDates[index]);
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
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 23, 59, 59);
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

  private sanitizeProposal(raw: any, dayDates?: string[]): any {
    const rawTasks = Array.isArray(raw?.proposedTasks) ? raw.proposedTasks : [];
    const rawMilestones = Array.isArray(raw?.milestones) ? raw.milestones : [];
    const rawAssumptions = Array.isArray(raw?.assumptions) ? raw.assumptions : [];

    return {
      goalSummary:
        sanitizeAIText(String(raw?.goalSummary || '')).slice(0, 300).trim() ||
        'Customized Daily Action Roadmap',
      milestones: rawMilestones.map((m: any, idx: number) => ({
        id: String(m?.id || `m-${idx + 1}`),
        title:
          sanitizeAIText(String(m?.title || `Phase ${idx + 1}`)).slice(0, 100).trim() ||
          `Phase ${idx + 1}`,
        description: m?.description ? sanitizeAIText(String(m.description)).slice(0, 300).trim() : null,
        order: typeof m?.order === 'number' && Number.isInteger(m.order) ? m.order : idx + 1,
      })),
      proposedTasks: rawTasks.map((t: any, index: number) => {
        const duration = Number(t?.estimatedDurationMinutes);
        return {
          title:
            sanitizeAIText(String(t?.title || '')).slice(0, 200).trim() ||
            `Day ${index + 1}: Action Item`,
          description: t?.description ? sanitizeAIText(String(t.description)).slice(0, 500).trim() : null,
          priority: this.normalizePriority(t?.priority),
          energyLevel: this.normalizeEnergy(t?.energyLevel),
          estimatedDurationMinutes:
            !isNaN(duration) && duration >= 5 && duration <= 480 ? Math.round(duration) : 25,
          suggestedDeadline: this.normalizeDeadline(t?.suggestedDeadline, dayDates?.[index]),
          milestoneId: t?.milestoneId ? String(t.milestoneId).trim() : null,
          subtasks: this.normalizeSubtasks(t?.subtasks),
        };
      }),
      assumptions: rawAssumptions
        .map((a: any) => sanitizeAIText(String(a || '')).slice(0, 200).trim())
        .filter(Boolean)
        .slice(0, 8),
      providerUsed: raw?.providerUsed ? String(raw.providerUsed) : undefined,
    };
  }
}
