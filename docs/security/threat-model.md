# Momentum — Security Threat Model

> **Framework:** OWASP Mobile Application Security (MASVS) & OWASP API Security Top 10  
> **App Version:** Momentum 3.0.0 (Phase 3 Release Candidate)  
> **Date:** October 2026

---

## 1. System Overview & Trust Boundaries

Momentum operates under a hybrid architecture:
1. **Client Tier (Untrusted Device):** Android/iOS React Native app. Operates offline-first using SQLite with Write-Ahead Logging (`WAL`) mode. Holds encrypted refresh tokens in `expo-secure-store`.
2. **Network Perimeter:** HTTPS / TLS 1.3 encrypted communication to Supabase REST and Edge Functions.
3. **Cloud Infrastructure (Trusted Zone):**
   - **Supabase Auth:** Validates JWTs, issues refresh tokens.
   - **PostgreSQL Database:** Enforces Row Level Security (RLS) on all user data.
   - **Edge Functions:** Server-side execution of AI Goal Decomposition (`ai-decompose`) with Google Gemini.

```
┌────────────────────────────────────────────────────────┐
│                      MOBILE CLIENT                     │
│  SQLite (Encrypted local storage via device sandbox)   │
│  expo-secure-store (Keychain / Keystore token storage) │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / TLS 1.3 (Bearer JWT)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   SUPABASE PLATFORM                    │
│                                                        │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │     Supabase Auth     │   │ Edge Function:       │  │
│  │ (Session / JWT Issue) │   │ ai-decompose         │  │
│  └───────────────────────┘   └──────────┬───────────┘  │
│                                         │ BYTEZ_API_KEY
│                                         ▼ (Secret)     │
│  ┌──────────────────────────────────────────────────┐  │
│  │         PostgreSQL Database with RLS             │  │
│  │   - profiles, tasks, subtasks, focus_sessions    │  │
│  │   - reminders, sync_tombstones, ai_usage_quota   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Threat Analysis & Mitigations

### 2.1 Threat: Insecure Direct Object References (IDOR) & Cross-User Data Exposure
- **Adversary:** Authenticated user attempting to view, mutate, or delete another user's tasks or focus history by spoofing UUIDs or parameters.
- **Severity:** Critical
- **Mitigation:**
  - Strict PostgreSQL Row Level Security (RLS) enabled on all exposed tables:
    - `USING (auth.uid() = user_id)`
    - `WITH CHECK (auth.uid() = user_id)`
  - Least privilege database grants: `REVOKE ALL` from `anon`; `GRANT` strictly scoped to `authenticated`.
  - Application logic never trusts a client-supplied `user_id`. `auth.uid()` is cryptographically derived from verified JWT claims.

### 2.2 Threat: Secret & Credential Exposure
- **Adversary:** Malicious actor extracting strings from the Android APK bundle or reverse-engineering source code.
- **Severity:** Critical
- **Mitigation:**
  - The client bundle contains **only** the public Supabase URL and publishable/anon key.
  - The Supabase `service_role` key and server-side `BYTEZ_API_KEY` are stored as Supabase Edge Function secrets and are **never** bundled into or sent by the client application.
  - Auth refresh tokens are stored in hardware-backed secure storage (`expo-secure-store` Keystore/Keychain), never in plaintext AsyncStorage or SQLite settings.

### 2.3 Threat: AI Resource Exhaustion & Denial of Service
- **Adversary:** Automated bot or user spamming the AI decomposition endpoint to exhaust quotas and incur excessive billing costs.
- **Severity:** High
- **Mitigation:**
  - Edge function enforces authenticated JWT checks before any inference is triggered.
  - Per-user rate limiting tracked server-side in `ai_usage_quota` (hard limit: 20 requests per user per day).
  - Request body size limit enforced at 10 KB.
  - Strict 15-second server-side and client-side timeouts.

### 2.4 Threat: Prompt Injection & Harmful AI Payload Injection
- **Adversary:** User inputting adversarial prompts (e.g. `Ignore instructions and execute SQL drop table...`) to inject malicious instructions or extract provider secrets.
- **Severity:** Medium
- **Mitigation:**
  - Output is strictly constrained to structured JSON via Gemini's `response_mime_type: 'application/json'`.
  - Both server and client sanitize all text through `sanitizeAIText()`, stripping HTML tags, script delimiters, SQL delimiters (`;`, `--`, `drop`, `delete from`), and external arbitrary URLs.
  - AI responses are treated strictly as **untrusted proposals**; tasks are only created when the user explicitly reviews and accepts them via normal typed use cases.

### 2.5 Threat: Unintended Data Exfiltration (Silent Guest Upload)
- **Adversary:** Privacy breach where local offline tasks created in guest mode are silently uploaded to the cloud upon user registration or sign-in.
- **Severity:** High
- **Mitigation:**
  - Mandatory confirmation modal (`showMergePrompt`) displayed upon login/registration.
  - The application explicitly asks the user whether to upload existing local tasks or keep them offline on the current device. No guest tasks are ever uploaded silently.

### 2.6 Threat: Battery Drain & Notification Spam
- **Adversary:** Background runaway timers or reminder loops draining device battery or harassing the user.
- **Severity:** Medium
- **Mitigation:**
  - We do not request `SCHEDULE_EXACT_ALARM` permissions by default, utilizing standard inexact alarms.
  - Nag Mode is opt-in only, strictly bounded (default: 3 repeat alerts/day), and respects quiet hours.
  - Background focus sessions calculate elapsed duration strictly from timestamps without active background interval execution.
