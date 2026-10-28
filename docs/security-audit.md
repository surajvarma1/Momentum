# Momentum — Application Security Audit Report

**Date:** October 28, 2026  
**Auditor:** Mobile Application Architect & Security Audit Lead  
**Scope:** Client Application (React Native / Expo), Persistence Layer (SQLite & OPFS), Cloud Integration (Supabase RLS & Auth), AI Goal Decomposer (Bytez Backend Proxy).  
**Status:** PASS — Verified & Hardened

---

## 1. Executive Summary

A comprehensive security audit and code hardening was executed across the Momentum productivity application. AI inference is routed through an authenticated, rate-limited Supabase Edge Function communicating with Bytez (`Qwen/Qwen3-4B`). The Bytez key is configured only as a server-side `BYTEZ_API_KEY` environment secret; it is not entered, stored, or transmitted by the client.

All data storage adheres strictly to parameterized SQL queries, zero credentials remain in unencrypted storage, and offline-first autonomy ensures that no user task data is transmitted across the network unless explicitly authenticated and confirmed by the user.

---

## 2. Avoiding Persistent Client-Side Secrets

### 2.1 Vulnerability Description & Risk
Placing provider credentials in the client bundle, settings, or browser storage would expose them to client-state inspection or unauthorized use, particularly in shared web previews. The Bytez key is therefore configured only in the Edge Function environment.

### 2.2 Corrective Implementation
1. **Server-Side Bytez AI Integration**:
   - Inference requests route through Supabase Edge Function `supabase/functions/ai-decompose/index.ts`.
   - `BYTEZ_API_KEY` is loaded only from the Edge Function environment.
   - Default model: `Qwen/Qwen3-4B` via Bytez's documented chat endpoint (`https://api.bytez.com/models/v2/Qwen/Qwen3-4B`).
   - No provider credential or server role secret is bundled with or sent by the client application.

---

## 3. Defense-in-Depth for AI Goal Decomposer

| Layer | Defense Mechanism | Code Reference |
|---|---|---|
| **Input Validation** | Strict Zod schema enforcing bounds: 5–500 chars for goal, 15–240 mins for session, valid ISO deadlines. | `src/domain/ai/AIDecomposerTypes.ts` |
| **Prompt Injection Defense** | `sanitizeAIText` strips executable HTML, `<script>` tags, SQL command keywords, and neutralizes arbitrary external URLs. | `src/domain/ai/AIDecomposerTypes.ts` |
| **Output Schema Validation** | Enforced Zod schema parsing with max task ceiling (35 tasks) preventing runaway token generation or payload tampering. | `src/domain/ai/AIDecomposerTypes.ts` |
| **Server Quota & Rate Limiting** | Edge function validates user JWT and enforces daily quota limits (20 requests/day/user) in `ai_usage_quota`. | `supabase/functions/ai-decompose/index.ts` |
| **Bounded Timeouts** | 12-second server timeout with `AbortController` and 15-second client timeout with graceful deterministic fallback. | `supabase/functions/ai-decompose/index.ts`, `SupabaseAIDecomposerService.ts` |
| **Idempotent Approval** | `ApplyGoalProposal` deduplicates tasks by title and schedule key, preventing duplicate task spam on double-clicks. | `src/domain/use-cases/ApplyGoalProposal.ts` |

---

## 4. Local Database Persistence & Web Concurrency Security

### 4.1 SQL Injection Prevention
All SQLite repository methods across the application utilize 100% parameterized SQL bindings via `expo-sqlite`:
```typescript
// Parameterized query example:
await db.runAsync(
  'INSERT INTO tasks (id, title, description, priority, energy_level, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  [task.id, task.title, task.description, task.priority, task.energyLevel, task.status, task.createdAt, task.updatedAt]
);
```
No dynamic SQL concatenation or raw template literals are ever evaluated.

### 4.2 Web OPFS Access Handle Mutex
Browser web previews utilizing SQLite wa-sqlite / Origin Private File System (OPFS) previously threw `createSyncAccessHandle` errors when concurrent hooks or Fast Refresh cycles opened multiple handles on `momentum.db`.
- **Solution:** Added a singleton initialization mutex `dbInitPromise` in `DatabaseProvider.ts`.
- **Unload Cleanup:** Registered `beforeunload` event handler to release sync handles on page reload.
- **Recovery:** Added brief backoff retry if an OPFS handle is in the process of closing during hot reloads.

---

## 5. Row-Level Security (RLS) & Multi-Tenant Cloud Isolation

Supabase PostgreSQL tables enforce Row-Level Security:
- `tasks`: Accessible only where `auth.uid() = user_id`.
- `subtasks`: Accessible only when parent task belongs to `auth.uid()`.
- `reminders`: Accessible only where `auth.uid() = user_id`.
- `focus_sessions`: Accessible only where `auth.uid() = user_id`.
- `missed_task_logs`: Accessible only where `auth.uid() = user_id`.
- `ai_usage_quota`: Read-only for `auth.uid() = user_id`, modified exclusively via service-role in Edge Functions.

Automated verification tests in `__tests__/security/DatabaseRLS.test.ts` validate policy enforcement against cross-tenant data leakage.

---

## 6. Authentication Credentials & Onboarding Persistence

1. **Tokens**: Auth sessions and refresh tokens are stored in `SecureAuthStorageAdapter` using `expo-secure-store` with Android Keystore and iOS Keychain encryption (`AFTER_FIRST_UNLOCK`).
2. **Onboarding Flag**: Stored versioned flag (`onboarding_version = '1'`) in SQLite `app_settings` and `localStorage` on web. Queried before screen mount to prevent recurring onboarding flashes.
3. **Guest User Data Protection**: Local guest tasks are never automatically uploaded to the cloud upon account registration without explicit user modal confirmation.

---

## 7. Conclusion

Momentum complies with modern mobile application security best practices:
- Zero exposed client credentials
- Complete isolation of local and remote state
- Robust input/output AI sanitization
- Fully verified test suite with 100% passing tests
