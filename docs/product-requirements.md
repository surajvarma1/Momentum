# Momentum — Product Requirements Document

> **App Name:** Momentum ("Build momentum. Crush your goals.")  
> **Version:** 3.0.0 (Release Candidate)  
> **Current Phase:** Phase 3 — Secure Cloud Sync, AI Goal Decomposer and Release Readiness  
> **Platform:** Android-first (Expo SDK 58, React Native 0.88, React 19.3)

---

## 1. Product Vision

**Momentum** is a high-performance, distraction-free productivity engine that turns high-level intentions into relentless execution. Designed with a charcoal/ink visual language and violet accents, Momentum combines a structured task hierarchy with deterministic local reminder scheduling, an accountable Focus Arena, proactive missed-task recovery, real streak analytics, optional end-to-end cloud synchronization, and server-side AI goal decomposition.

---

## 2. Phase 3 Scope & Capabilities

### 2.1 Supabase Authentication & Session Security
- **Authentication Flows:** Sign up, email/password login, logout, password recovery, session restoration, and token expiration handling.
- **Hardware-Backed Session Storage:** Tokens and JWTs are managed via `expo-secure-store` (`SecureAuthStorageAdapter`) with keychain accessibility `AFTER_FIRST_UNLOCK`. Sensitive session material is never stored in unencrypted application preferences or SQLite.
- **Local-First / Guest Mode:** Complete guest mode support allows full offline usage without an account.
- **Explicit Consent for Local Task Merging:** When a guest user logs in or registers, Momentum prompts with an explicit confirmation dialog asking whether to merge existing local tasks with the cloud account. Local tasks are **never** silently uploaded.

### 2.2 PostgreSQL Schema & Row Level Security (RLS)
- **Versioned Migration:** `supabase/migrations/20261025000001_phase3_schema.sql`.
- **Tables:** `profiles`, `tasks`, `subtasks`, `focus_sessions`, `reminders`, `sync_tombstones`, and `ai_usage_quota`.
- **Strict Isolation via RLS:** Every exposed table enforces RLS where `auth.uid() = user_id` on `SELECT`, `UPDATE`, `DELETE`, and `WITH CHECK (auth.uid() = user_id)` on `INSERT`.
- **Least Privilege Grants:** `REVOKE ALL` from anonymous users; grants restricted strictly to `authenticated` role.
- **Automated Security Verification:** Covered by automated security tests in `__tests__/security/DatabaseRLS.test.ts`.

### 2.3 Local-First Offline Synchronization (`SyncEngine`)
- **Single Source of Truth:** Local SQLite remains the immediate source of truth for the currently open device.
- **Persistent Outbox:** SQLite `sync_outbox` table buffers mutations (`CREATE`, `UPDATE`, `DELETE`).
- **Tombstone Protection:** `sync_tombstones` table prevents deleted items from unexpectedly resurrecting upon pulling remote changes.
- **Bounded Backoff & Concurrency:** Exponential backoff with random jitter (up to 8 retries) protects against server errors and connection drops.
- **Connectivity Awareness:** Reacts to network transitions via `@react-native-community/netinfo` with debounce and in-progress locks.

### 2.4 AI Goal Decomposer (`ai-decompose`)
- **Server-Side Edge Function:** Deployed on Supabase Edge Functions (`supabase/functions/ai-decompose/index.ts`).
- **Provider Key Handling:** `BYTEZ_API_KEY` is read only from the Edge Function environment; the client does not accept or send provider keys or bundle server credentials.
- **Default AI Model:** Bytez `Qwen/Qwen3-4B`, configurable through the Edge Function `BYTEZ_MODEL` environment variable.
- **JWT Identity Derivation:** Caller identity is derived from verified JWT claims (`auth.getUser()`), rejecting spoofed client identities.
- **Usage Quotas & Rate Limiting:** Enforces a per-user limit of 20 requests per day stored in PostgreSQL `ai_usage_quota`.
- **Input & Output Validation:** Validates requests using strict Zod schemas with a 10 KB payload ceiling.
- **Prompt Safety & Sanitization:** Text is sanitized to neutralize executable HTML/script tags, SQL delimiters, and arbitrary external URLs.
- **Untrusted Proposal Model:** AI outputs are presented on an interactive Review Screen (`app/ai/decompose.tsx`). Tasks are created solely upon explicit user selection and approval through domain use cases.
- **Offline Fallback:** If cloud connectivity is unavailable, produces a deterministic rule-based heuristic proposal without corrupting state.

### 2.5 Release Readiness & Google Play Standards
- **Android Target API:** Targets Android 16 (API 36) complying with published Google Play 2026 requirements.
- **Least-Privilege Permissions:** Only `POST_NOTIFICATIONS` requested; no exact alarms or invasive permissions.
- **CI/CD Quality Gate:** GitHub Actions pipeline (`.github/workflows/ci.yml`) runs linting, typechecking, 144 Jest tests, and Expo diagnostics.
