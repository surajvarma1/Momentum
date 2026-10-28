# ADR 0003: Secure Cloud Sync, PostgreSQL RLS, and AI Goal Decomposer

## Status
Accepted

## Context
In Phase 3 of Momentum, the application requires:
1. Optional cloud authentication and secure session management.
2. An offline-first bidirectional synchronization engine that keeps local SQLite as the primary source of truth.
3. PostgreSQL persistence with strict Row Level Security (RLS) guaranteeing cross-user isolation.
4. An AI Goal Decomposition service powered by Bytez, with provider credentials configured only in the Edge Function environment.
5. Android release readiness complying with Google Play's 2026 Android 16 (API 36) target requirements.

## Decisions

### 1. Local-First Source of Truth and Offline Outbox
- The open device's SQLite database is **always** the immediate source of truth. Mutations succeed locally without waiting for network round-trips.
- A persistent `sync_outbox` table records pending mutations (`CREATE`, `UPDATE`, `DELETE`).
- A `sync_tombstones` table tracks deleted records to prevent deleted items from unexpectedly resurrecting upon pulling remote changes.
- Bounded exponential backoff with random jitter (up to 8 retries) handles transient connection drops and server errors.
- Sync operations are connectivity-aware via `@react-native-community/netinfo`, debounced to prevent concurrent sync loops.

### 2. Token Security & No Silent Exfiltration
- JWT and refresh tokens are stored exclusively in hardware-backed secure storage via `expo-secure-store` with `AFTER_FIRST_UNLOCK` accessibility. Tokens are never stored in plaintext preferences or SQLite.
- Guest mode is fully supported. If a guest registers an account or signs in, Momentum displays an explicit confirmation dialog asking whether to merge existing local tasks or keep them offline on the current device. No data is uploaded silently.

### 3. Server-Side PostgreSQL Schema and Row Level Security
- All cloud tables (`profiles`, `tasks`, `subtasks`, `focus_sessions`, `reminders`, `sync_tombstones`, `ai_usage_quota`) have explicit Row Level Security enabled.
- Access policies require `auth.uid() = user_id` for `SELECT`, `UPDATE`, `DELETE`, and `WITH CHECK (auth.uid() = user_id)` on `INSERT`.
- Anonymous access is explicitly revoked (`REVOKE ALL ON public.* FROM anon`).

### 4. Server-Side AI Goal Decomposition (`ai-decompose`)
- AI inference is executed behind a Supabase Edge Function (`ai-decompose`).
- `BYTEZ_API_KEY` is maintained only as an Edge Function environment secret and is never bundled in or sent by the mobile application.
- Caller identity is verified via Supabase JWT claims (`auth.getUser()`), not untrusted client bodies.
- A per-user quota of 20 requests/day is tracked server-side in `ai_usage_quota`.
- Input and output are strictly validated against Zod schemas. Output is sanitized via `sanitizeAIText` to eliminate potential shell, SQL, or arbitrary URL injection.
- AI proposals are non-destructive: users review, select, and approve proposed tasks before they are created via domain use cases.

### 5. Google Play Android 16 (API 36) Compliance
- Configured `targetSdkVersion: 36` and `compileSdkVersion: 36` in `app.json` meeting Google Play's published August 2026 requirements.
- Strict least-privilege permission model: only `POST_NOTIFICATIONS` requested.

## Consequences
- Guaranteed data safety and zero cross-user leakage (verified by automated RLS tests).
- Seamless offline operation: app functions fully when disconnected, reconnecting with deterministic synchronization.
- Predictable AI costs and zero credential disclosure.
