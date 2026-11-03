// Supabase Edge Function: ai-decompose
// Deno Runtime — Secure Server-Side Multi-Provider AI Cascade
// Supported Providers: NVIDIA NIM -> OpenRouter -> Google Gemini -> Bytez

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AIProviderResult {
  rawJson: string;
  providerName: string;
  modelName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify Authentication (Supports authenticated Supabase users and anon key clients)
    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization or apikey header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    let user: any = null;
    if (supabaseUrl && supabaseAnonKey && authHeader.startsWith('Bearer ')) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data } = await userClient.auth.getUser();
        user = data?.user || null;
      } catch {
        // Fallback for guest mode or expired tokens
      }
    }

    // 2. Request body validation
    const rawBody = await req.text();
    if (rawBody.length > 20480) {
      // 20 KB limit
      return new Response(
        JSON.stringify({ error: 'Payload too large (max 20KB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { goalDescription, deadline, preferredSessionMinutes, timezone, provider } = body;

    if (!goalDescription || typeof goalDescription !== 'string' || goalDescription.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'Invalid goalDescription (minimum 5 characters required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Quota & Rate Limit Check (resilient: does not fail if table is uninitialized)
    if (user && supabaseServiceKey && supabaseUrl) {
      try {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: quotaData } = await adminClient
          .from('ai_usage_quota')
          .select('daily_requests_count, daily_quota_limit, quota_reset_date')
          .eq('user_id', user.id)
          .maybeSingle();

        const todayDate = new Date().toISOString().split('T')[0];
        let dailyRequests = quotaData?.daily_requests_count ?? 0;
        const dailyLimit = quotaData?.daily_quota_limit ?? 30;

        if (quotaData && quotaData.quota_reset_date !== todayDate) {
          dailyRequests = 0; // Reset for new day
        }

        if (dailyRequests >= dailyLimit) {
          return new Response(
            JSON.stringify({ error: 'Daily AI decomposition quota exceeded. Please try again tomorrow.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      } catch (quotaErr) {
        console.warn('Quota check skipped:', quotaErr);
      }
    }

    // 4. Calculate Timeline and Persona
    const timeline = calculateTimeline(goalDescription, deadline);
    const persona = detectGoalPersona(goalDescription);
    const sessionTime = preferredSessionMinutes && preferredSessionMinutes >= 5 ? preferredSessionMinutes : 25;

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

    const userPrompt = `Goal: "${goalDescription.trim()}"
Target Timeline: Exactly ${timeline.totalDays} days.
Daily Focus Duration: ${sessionTime} minutes per session.
Timezone: ${timezone || 'UTC'}
Current Reference Date: ${new Date().toISOString().split('T')[0]} (Day 1 starts on ${timeline.dayDates[0]}).

Specialist Guidance:
${persona.instructions}

REQUIREMENTS:
1. Provide progressive daily-wise tasks covering all ${timeline.totalDays} days (Day 1: ..., Day 2: ..., through Day ${timeline.totalDays}: ...).
2. Each daily task MUST contain 3 to 5 practical, specific, actionable subtasks.
3. Organize tasks into milestones (m-1, m-2, etc.).
4. Calibrate intensity realistically for a ${sessionTime}-minute daily session.
5. Strictly use current/future ISO-8601 deadlines starting from ${timeline.dayDates[0]}.
6. Strictly return valid raw JSON only.`;

    // 5. Multi-Provider Cascade: NVIDIA NIM -> OpenRouter -> Gemini -> Bytez
    const selectedPreference = provider || 'auto';
    const queue = resolveServerProviderQueue(selectedPreference);
    const errorsEncountered: string[] = [];

    let providerResult: AIProviderResult | null = null;

    for (const p of queue) {
      try {
        if (p === 'nvidia') {
          providerResult = await callNvidiaServer(systemPrompt, userPrompt);
        } else if (p === 'openrouter') {
          providerResult = await callOpenRouterServer(systemPrompt, userPrompt);
        } else if (p === 'gemini') {
          providerResult = await callGeminiServer(systemPrompt, userPrompt);
        } else if (p === 'bytez') {
          providerResult = await callBytezServer(systemPrompt, userPrompt);
        }

        if (providerResult && providerResult.rawJson) {
          break;
        }
      } catch (err: any) {
        errorsEncountered.push(`[${p.toUpperCase()}]: ${err.message}`);
        console.warn(`Server provider ${p} failed: ${err.message}. Cascading to next...`);
      }
    }

    if (!providerResult || !providerResult.rawJson) {
      console.error('All AI providers exhausted:', errorsEncountered.join('; '));
      return new Response(
        JSON.stringify({
          error: 'AI services are temporarily unavailable. Please try again shortly or create tasks manually.',
          diagnostics: errorsEncountered,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Extract, sanitize and structure proposal
    const parsed = extractJson(providerResult.rawJson);
    const sanitized = sanitizeProposal(parsed, timeline.dayDates, sessionTime);
    sanitized.providerUsed = `${providerResult.providerName} (${providerResult.modelName})`;

    // 7. Record user quota if authenticated
    if (user && supabaseServiceKey && supabaseUrl) {
      try {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const todayDate = new Date().toISOString().split('T')[0];
        await adminClient.from('ai_usage_quota').upsert({
          user_id: user.id,
          daily_requests_count: 1,
          last_request_at: new Date().toISOString(),
          quota_reset_date: todayDate,
          updated_at: new Date().toISOString(),
        });
      } catch (quotaErr) {
        console.warn('Quota update skipped:', quotaErr);
      }
    }

    return new Response(JSON.stringify(sanitized), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('ai-decompose unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error in AI decomposition' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// Server Provider Callers
async function callNvidiaServer(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
  const key = Deno.env.get('NVIDIA_API_KEY');
  const model = Deno.env.get('NVIDIA_MODEL') || 'nvidia/nemotron-3.5-super-vl-120b-a12b';
  if (!key) throw new Error('NVIDIA_API_KEY not configured on server');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000); // 35s timeout

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
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
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NVIDIA HTTP ${res.status}: ${errText.slice(0, 160)}`);
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    const rawJson = message?.content || message?.reasoning_content || message?.reasoning || '';
    if (!rawJson) throw new Error('NVIDIA returned empty message content');

    extractJson(rawJson); // Verify parseable
    return { rawJson, providerName: 'NVIDIA NIM', modelName: model };
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

async function callOpenRouterServer(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  const configuredModel = Deno.env.get('OPENROUTER_MODEL') || 'cohere/north-mini-code:free';
  if (!key) throw new Error('OPENROUTER_API_KEY not configured on server');

  const candidateModels = [
    configuredModel,
    'cohere/north-mini-code:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'liquid/lfm-2.5-2.6b:free',
  ];
  const modelsToTry = [...new Set(candidateModels.filter(Boolean))];

  for (const currentModel of modelsToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
            { role: 'system', content: `${systemPrompt}\nOutput valid raw JSON only.` },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      const choice = data?.choices?.[0];
      let rawJson = choice?.message?.content || choice?.message?.reasoning || '';
      if (!rawJson.trim()) continue;

      extractJson(rawJson);
      return { rawJson, providerName: 'OpenRouter', modelName: currentModel };
    } catch {
      clearTimeout(timer);
      continue;
    }
  }

  throw new Error('All OpenRouter candidate models exhausted or timed out');
}

async function callGeminiServer(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
  const key = Deno.env.get('GEMINI_API_KEY');
  const configuredModel = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-lite-latest';
  if (!key) throw new Error('GEMINI_API_KEY not configured on server');

  const candidateModels = [
    configuredModel,
    'gemini-flash-lite-latest',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
  ];
  const modelsToTry = [...new Set(candidateModels.filter(Boolean))];

  for (const currentModel of modelsToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawJson) continue;

      extractJson(rawJson);
      return { rawJson, providerName: 'Google Gemini', modelName: currentModel };
    } catch {
      clearTimeout(timer);
      continue;
    }
  }

  throw new Error('All Gemini candidate models failed');
}

async function callBytezServer(systemPrompt: string, userPrompt: string): Promise<AIProviderResult> {
  const key = Deno.env.get('BYTEZ_API_KEY');
  const model = Deno.env.get('BYTEZ_MODEL') || 'Qwen/Qwen2.5-7B-Instruct';
  if (!key) throw new Error('BYTEZ_API_KEY not configured on server');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('https://api.bytez.com/models/v2/openai/v1/chat/completions', {
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
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Bytez HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawJson = data?.choices?.[0]?.message?.content || '';
    if (!rawJson) throw new Error('Bytez returned empty content');

    extractJson(rawJson);
    return { rawJson, providerName: 'Bytez', modelName: model };
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

function resolveServerProviderQueue(pref: string): string[] {
  if (pref !== 'auto' && pref !== 'none') {
    return [pref];
  }
  const queue: string[] = [];
  if (Deno.env.get('NVIDIA_API_KEY')) queue.push('nvidia');
  if (Deno.env.get('OPENROUTER_API_KEY')) queue.push('openrouter');
  if (Deno.env.get('GEMINI_API_KEY')) queue.push('gemini');
  if (Deno.env.get('BYTEZ_API_KEY')) queue.push('bytez');

  if (queue.length === 0) {
    // Attempt standard cascade
    queue.push('nvidia', 'openrouter', 'gemini', 'bytez');
  }
  return queue;
}

function calculateTimeline(goalDescription: string, deadline?: string | null): { totalDays: number; dayDates: string[] } {
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
    } catch {}
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

function detectGoalPersona(goal: string): { role: string; instructions: string } {
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
    text.includes('diet')
  ) {
    return {
      role: 'Certified Elite Personal Fitness Trainer & Strength Coach',
      instructions:
        'Structure a progressive day-by-day workout routine (Push, Pull, Legs, Core, Cardio, Rest). Each day must include 3-5 specific exercises with sets and reps as subtasks.',
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
    text.includes('react') ||
    text.includes('python') ||
    text.includes('angular')
  ) {
    return {
      role: 'Senior Engineering Manager & Technical Project Lead',
      instructions:
        'Structure an agile day-by-day development roadmap (architecture, models, APIs, UI screens, tests, release). Each day must have 3-5 concrete technical deliverables as subtasks.',
    };
  }
  if (
    text.includes('study') ||
    text.includes('exam') ||
    text.includes('learn') ||
    text.includes('course') ||
    text.includes('book') ||
    text.includes('read')
  ) {
    return {
      role: 'Master Academic Advisor & Accelerated Learning Strategist',
      instructions:
        'Structure a progressive day-by-day curriculum with foundational concepts, practice drills, active recall reviews, and mock assessments leading to the target deadline.',
    };
  }
  return {
    role: 'Executive Strategic Productivity Coach',
    instructions:
      'Decompose this goal into progressive, day-by-day execution blocks calibrated to the deadline.',
  };
}

function extractJson(rawText: string): any {
  const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('AI returned non-JSON text format');
  }
}

function sanitizeProposal(raw: any, dayDates: string[], defaultDuration: number): any {
  const rawTasks = Array.isArray(raw?.proposedTasks) ? raw.proposedTasks : [];
  const rawMilestones = Array.isArray(raw?.milestones) ? raw.milestones : [];
  const rawAssumptions = Array.isArray(raw?.assumptions) ? raw.assumptions : [];

  return {
    goalSummary: String(raw?.goalSummary || '').slice(0, 300).trim() || 'Customized Daily Action Roadmap',
    milestones: rawMilestones.map((m: any, idx: number) => ({
      id: String(m?.id || `m-${idx + 1}`),
      title: String(m?.title || `Phase ${idx + 1}`).slice(0, 100).trim(),
      description: m?.description ? String(m.description).slice(0, 300).trim() : null,
      order: typeof m?.order === 'number' ? m.order : idx + 1,
    })),
    proposedTasks: rawTasks.map((t: any, index: number) => {
      const dur = Number(t?.estimatedDurationMinutes);
      return {
        title: String(t?.title || `Day ${index + 1}: Action Item`).slice(0, 200).trim(),
        description: t?.description ? String(t.description).slice(0, 500).trim() : null,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'IMPORTANT'].includes(String(t?.priority || '').toUpperCase())
          ? String(t.priority).toUpperCase()
          : 'MEDIUM',
        energyLevel: ['LOW', 'MEDIUM', 'HIGH'].includes(String(t?.energyLevel || '').toUpperCase())
          ? String(t.energyLevel).toUpperCase()
          : 'MEDIUM',
        estimatedDurationMinutes: !isNaN(dur) && dur >= 5 && dur <= 480 ? Math.round(dur) : defaultDuration,
        suggestedDeadline: dayDates[index] || new Date().toISOString(),
        milestoneId: t?.milestoneId ? String(t.milestoneId).trim() : null,
        subtasks: Array.isArray(t?.subtasks)
          ? t.subtasks.map((st: any) => (typeof st === 'string' ? st : st?.title || String(st || '')).slice(0, 100).trim()).filter(Boolean).slice(0, 5)
          : [],
      };
    }),
    assumptions: rawAssumptions
      .map((a: any) => String(a || '').slice(0, 200).trim())
      .filter(Boolean)
      .slice(0, 8),
  };
}
