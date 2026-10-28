# Momentum — Data Model

> **Local Storage:** Expo SQLite (WAL mode, foreign keys, versioned migrations)  
> **Cloud Storage:** Supabase PostgreSQL with strict Row Level Security (RLS)  
> **Timestamp Format:** ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`)

---

## 1. Local SQLite Schema (Migration 001, 002 & 003)

### Tables Overview
```
┌───────────────────┐       ┌───────────────────┐
│      tasks        │       │     subtasks       │
├───────────────────┤       ├───────────────────┤
│ id (PK)           │◀──┐   │ id (PK)           │
│ title             │   └───│ task_id (FK)       │
│ description       │       │ title              │
│ priority          │       │ is_completed       │
│ energy_level      │       │ sort_order         │
│ status            │       │ server_version     │
│ estimated_dur_min │       │ created_at         │
│ deadline          │       │ updated_at         │
│ deadline_timezone │       └───────────────────┘
│ tags              │
│ recurrence_rule   │       ┌───────────────────┐
│ server_version    │       │     reminders     │
│ created_at        │       ├───────────────────┤
│ updated_at        │◀──┐   │ id (PK)           │
│ completed_at      │   └───│ task_id (FK)       │
│ cancelled_at      │       │ type, trigger_time │
│ sort_order        │       │ repeat_count       │
└───────────────────┘       │ max_repeats        │
          │                 │ is_nag_enabled     │
          │                 │ snooze_until       │
          │                 │ status             │
          │                 └───────────────────┘
          │
          ├─────────────────────────┐
          ▼                         ▼
┌───────────────────┐     ┌───────────────────────┐
│  focus_sessions   │     │  missed_task_records  │
├───────────────────┤     ├───────────────────────┤
│ id (PK)           │     │ id (PK)               │
│ task_id (FK opt)  │     │ task_id (FK)          │
│ state             │     │ detected_at           │
│ duration_minutes  │     │ suggested_deadline    │
│ start_time        │     │ action_taken          │
│ pause_time        │     │ deferral_reason       │
│ total_paused_ms   │     │ resolved_at           │
└───────────────────┘     └───────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               PHASE 3 SYNC PERSISTENCE                  │
├─────────────────────────┬───────────────────────────────┤
│       sync_outbox       │        sync_tombstones        │
├─────────────────────────┼───────────────────────────────┤
│ id (PK)                 │ id (PK)                       │
│ mutation_type           │ entity_type                   │
│ entity_type             │ entity_id                     │
│ entity_id               │ deleted_at                    │
│ payload (JSON)          ├───────────────────────────────┤
│ created_at              │         sync_metadata         │
│ retry_count             ├───────────────────────────────┤
│ last_attempt_at         │ key (PK)                      │
│ error_message           │ value                         │
└─────────────────────────┴───────────────────────────────┘
```

---

## 2. Remote PostgreSQL Cloud Schema

Defined in `supabase/migrations/20261025000001_phase3_schema.sql`.

### Tables and Constraints

1. **`public.profiles`**:
   - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `email TEXT NOT NULL`
   - `display_name TEXT`
   - `preferences JSONB NOT NULL DEFAULT '{}'::jsonb`
   - `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`

2. **`public.tasks`**:
   - `id UUID PRIMARY KEY`
   - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200)`
   - `description TEXT`
   - `priority TEXT NOT NULL DEFAULT 'MEDIUM'`
   - `energy_level TEXT NOT NULL DEFAULT 'MEDIUM'`
   - `status TEXT NOT NULL DEFAULT 'PENDING'`
   - `estimated_duration_minutes INTEGER`
   - `deadline TIMESTAMPTZ`
   - `deadline_timezone TEXT`
   - `tags JSONB NOT NULL DEFAULT '[]'::jsonb`
   - `recurrence_rule JSONB`
   - `server_version INTEGER NOT NULL DEFAULT 1`
   - `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`

3. **`public.subtasks`**:
   - `id UUID PRIMARY KEY`
   - `task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE`
   - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `title TEXT NOT NULL`
   - `is_completed BOOLEAN NOT NULL DEFAULT FALSE`
   - `sort_order INTEGER NOT NULL DEFAULT 0`
   - `server_version INTEGER NOT NULL DEFAULT 1`

4. **`public.sync_tombstones`**:
   - `id UUID PRIMARY KEY`
   - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `entity_type TEXT NOT NULL`
   - `entity_id UUID NOT NULL`
   - `deleted_at TIMESTAMPTZ NOT NULL`

5. **`public.ai_usage_quota`**:
   - `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `daily_requests_count INTEGER NOT NULL DEFAULT 0`
   - `daily_quota_limit INTEGER NOT NULL DEFAULT 20`
   - `last_request_at TIMESTAMPTZ`
   - `quota_reset_date DATE NOT NULL DEFAULT CURRENT_DATE`

---

## 3. Row Level Security (RLS) Policies

All exposed PostgreSQL tables enforce RLS:
```sql
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own tasks" ON public.tasks
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON public.tasks
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON public.tasks
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
```

Anonymous users are explicitly barred:
```sql
REVOKE ALL ON public.profiles, public.tasks, public.subtasks,
               public.focus_sessions, public.reminders,
               public.sync_tombstones, public.ai_usage_quota
FROM anon, public;
```
