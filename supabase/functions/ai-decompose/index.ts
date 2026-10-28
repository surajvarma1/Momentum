// Supabase Edge Function: ai-decompose
// Deno Runtime

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
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify Authentication (Supports authenticated Supabase users and guest clients with anon key)
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

    // 2. Request size & body validation
    const rawBody = await req.text();
    if (rawBody.length > 10240) {
      // 10 KB limit
      return new Response(
        JSON.stringify({ error: 'Payload too large (max 10KB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = JSON.parse(rawBody);
    const { goalDescription, deadline, preferredSessionMinutes, timezone } = body;

    if (!goalDescription || typeof goalDescription !== 'string' || goalDescription.length < 5) {
      return new Response(
        JSON.stringify({ error: 'Invalid goalDescription (minimum 5 characters required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Quota & Rate Limit Check (resilient: does not fail if quota table is uninitialized)
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
        const dailyLimit = quotaData?.daily_quota_limit ?? 20;

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
        console.warn('Quota check skipped due to database unavailability:', quotaErr);
      }
    }

    // 4. Bytez AI Inference (Qwen/Qwen3-4B via Bytez API)
    const bytezApiKey = Deno.env.get('BYTEZ_API_KEY');
    const bytezModel = Deno.env.get('BYTEZ_MODEL') || 'Qwen/Qwen3-4B';

    if (!bytezApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI provider is temporarily unavailable (BYTEZ_API_KEY not configured)' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Persona & Domain guidance
    const lowerGoal = goalDescription.toLowerCase();
    let personaRole = 'Executive Strategic Productivity Coach';
    let personaGuidance = 'Decompose this goal into progressive, day-by-day execution blocks calibrated to the deadline.';

    if (
      lowerGoal.includes('body') ||
      lowerGoal.includes('gym') ||
      lowerGoal.includes('workout') ||
      lowerGoal.includes('muscle') ||
      lowerGoal.includes('fitness') ||
      lowerGoal.includes('exercise') ||
      lowerGoal.includes('weight') ||
      lowerGoal.includes('fat')
    ) {
      personaRole = 'Certified Elite Personal Fitness Trainer & Strength Coach';
      personaGuidance = 'Act as an expert fitness trainer. Structure a progressive day-by-day workout routine (e.g., Push, Pull, Legs, Core, Active Recovery) covering the timeframe. Each day must include 3-5 specific exercises with sets and reps as subtasks.';
    } else if (
      lowerGoal.includes('code') ||
      lowerGoal.includes('app') ||
      lowerGoal.includes('software') ||
      lowerGoal.includes('build') ||
      lowerGoal.includes('website')
    ) {
      personaRole = 'Senior Engineering Manager & Technical Project Lead';
      personaGuidance = 'Act as a senior tech lead. Structure an agile day-by-day development roadmap (architecture, models, APIs, UI screens, tests, release). Each day must have 3-5 concrete technical deliverables as subtasks.';
    }

    const prompt = `You are a ${personaRole}.
The user has committed to this goal: "${goalDescription}".
Target Deadline: ${deadline || 'Flexible'}
Focus Session Duration: ${preferredSessionMinutes || 25} minutes.
Timezone: ${timezone || 'UTC'}

${personaGuidance}

REQUIREMENTS:
1. Provide a progressive day-by-day task roadmap matching the timeframe (e.g. "Day 1: ...", "Day 2: ...").
2. Each task must have 3-5 practical actionable subtasks.
3. Group tasks into milestone phases (e.g., "m-1": "Phase 1: Foundations", "m-2": "Phase 2: Escalation").
4. Output must be STRICT JSON ONLY without markdown backticks or commentary.

JSON Schema:
{
  "goalSummary": "${personaRole} roadmap for: ${goalDescription}",
  "milestones": [
    {"id": "m-1", "title": "Phase 1: Foundation", "description": "Focus...", "order": 1}
  ],
  "proposedTasks": [
    {
      "title": "Day 1: [Topic]",
      "description": "Daily guidance...",
      "priority": "HIGH",
      "energyLevel": "HIGH",
      "estimatedDurationMinutes": ${preferredSessionMinutes || 25},
      "suggestedDeadline": null,
      "milestoneId": "m-1",
      "subtasks": ["Action 1", "Action 2", "Action 3"]
    }
  ],
  "assumptions": ["Progressive periodization applied", "Tailored for ${preferredSessionMinutes || 25} min daily sessions"]
}`;

    const bytezUrl = `https://api.bytez.com/models/v2/${bytezModel}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second bounded server timeout

    let rawContent = '';
    try {
      const bytezResponse = await fetch(bytezUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bytezApiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a precise JSON-generating assistant. Do not output analysis or think tags. Respond with valid raw JSON matching the user schema only, without markdown backticks or commentary.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          params: {
            temperature: 0.2,
            max_new_tokens: 2048,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!bytezResponse.ok) {
        const errText = await bytezResponse.text();
        return new Response(
          JSON.stringify({
            error: 'Bytez AI provider failed to generate decomposition',
            details: errText.slice(0, 120),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const bytezData = await bytezResponse.json();
      if (bytezData?.error) {
        return new Response(
          JSON.stringify({
            error: 'Bytez AI provider failed to generate decomposition',
            details: String(bytezData.error).slice(0, 120),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const output = bytezData?.output;
      rawContent =
        typeof output === 'string'
          ? output
          : typeof output?.content === 'string'
            ? output.content
            : Array.isArray(output?.content)
              ? output.content
                  .map((part: { text?: string }) => part.text || '')
                  .join('')
              : '';
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === 'AbortError';
      return new Response(
        JSON.stringify({
          error: isTimeout ? 'Bytez AI service timed out (>12s)' : 'Bytez network error',
          details: fetchErr.message,
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!rawContent) {
      return new Response(
        JSON.stringify({ error: 'AI returned empty content' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Strip markdown code fences if model returned them
    const cleanedContent = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsedProposal = JSON.parse(cleanedContent);

    // 5. Update user AI quota if user and service key available
    if (user && supabaseServiceKey && supabaseUrl) {
      try {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const todayDate = new Date().toISOString().split('T')[0];
        await adminClient
          .from('ai_usage_quota')
          .upsert({
            user_id: user.id,
            daily_requests_count: 1,
            last_request_at: new Date().toISOString(),
            quota_reset_date: todayDate,
            updated_at: new Date().toISOString(),
          });
      } catch (quotaUpdateErr) {
        console.warn('Quota update skipped:', quotaUpdateErr);
      }
    }

    return new Response(JSON.stringify(parsedProposal), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
