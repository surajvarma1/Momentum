# Momentum — Security Audit Findings Report

> **Standard:** OWASP Mobile Application Security Verification Standard (MASVS v2.0)  
> **Target:** Momentum Mobile App & Supabase Backend (Phase 3)  
> **Date:** October 2026  
> **Audit Status:** Completed — Zero Critical/High Unresolved Vulnerabilities

---

## 1. Executive Summary

A comprehensive security audit of Momentum was conducted covering client-side mobile security, authentication flows, PostgreSQL Row Level Security (RLS), AI edge functions, platform permissions, and CI/CD pipelines.

| Area | Status | Findings | Resolution |
|---|---|---|---|
| **1. Authentication & Session Handling** | PASSED | Refresh tokens stored in Keychain/Keystore via `expo-secure-store`. No sensitive credentials in AsyncStorage or logs. | Implemented custom `SecureAuthStorageAdapter`. |
| **2. Database Grants & RLS** | PASSED | 100% of public tables have RLS enabled with `auth.uid() = user_id`. `REVOKE ALL` from anonymous users. | Automated RLS security test suite passes. |
| **3. Insecure Direct Object References (IDOR)** | PASSED | Users cannot read, mutate, or delete records belonging to other users. Spoofed `user_id` values rejected by `WITH CHECK`. | Validated in automated tests. |
| **4. Secrets & Credentials Exposure** | PASSED | Zero production secrets or service-role keys bundled in APK. AI API keys isolated in Supabase Edge Function environment. | Secret scanning verified. |
| **5. SQL Injection & Input Validation** | PASSED | All client SQLite interactions use parameterized queries (`?`). Server-side PostgreSQL uses parameterized queries. | Zod input validation schemas enforced. |
| **6. Rate Limiting & Resource Exhaustion** | PASSED | AI endpoint protected by authenticated JWT, 10 KB payload ceiling, and 20 request/day quota tracked in PostgreSQL. | Enforced in `ai_usage_quota`. |
| **7. Prompt Injection & AI Data Disclosure** | PASSED | Output restricted to JSON schema. AI text passed through `sanitizeAIText()` to strip SQL, HTML/script, and URLs. | Untrusted AI proposal review pattern enforced. |
| **8. Android Manifest & Permissions** | PASSED | Only `POST_NOTIFICATIONS` requested. No exact alarm permissions requested. Target SDK updated to Android 16 (API 36). | Meets Google Play 2026 standard. |
| **9. Privacy & Silent Exfiltration** | PASSED | Guest tasks are never uploaded silently. User must explicitly confirm merging local tasks on account login. | Modal prompt enforced. |
| **10. Dependency Vulnerabilities** | REVIEWED | `node-forge` (GHSA-86w9-cpqp-85rv) is an upstream build-time dependency of `@expo/cli`. Zod patched to `4.6.7`. | Documented below. Zero runtime exposure on Android device. |

---

## 2. Detailed Findings and Verifications

### SEC-01: Session Token Storage
- **Severity:** High (Mitigated)
- **Vulnerability:** Standard mobile storage (`AsyncStorage`, SQLite) stores tokens in unencrypted app storage which can be extracted on rooted devices or via adb backup.
- **Resolution:** Integrated `expo-secure-store` with `AFTER_FIRST_UNLOCK` keychain accessibility. Memory store fallback is utilized only for ephemeral Jest testing.

### SEC-02: Row Level Security on Database Mutations
- **Severity:** Critical (Mitigated)
- **Vulnerability:** If an authenticated user modifies the payload `user_id` to target another user's task, standard updates could modify another user's data.
- **Resolution:** All RLS policies in `20261025000001_phase3_schema.sql` include both:
  - `USING (auth.uid() = user_id)` (determines which rows are visible/targetable)
  - `WITH CHECK (auth.uid() = user_id)` (prevents inserting or updating a row with a forged owner ID)
- Verified with automated tests in `__tests__/security/DatabaseRLS.test.ts`.

### SEC-03: Silent Task Upload on Account Switch / Login
- **Severity:** High (Mitigated)
- **Vulnerability:** A user working locally as a guest might sign in with a work or shared account; silently syncing their private tasks violates user consent.
- **Resolution:** Implemented explicit confirmation dialog (`showMergePrompt`) in `app/(auth)/login.tsx` asking whether to merge or keep tasks offline.

### SEC-04: AI Goal Decomposer Security
- **Severity:** High (Mitigated)
- **Vulnerability:** AI models can be tricked via jailbreaks to generate SQL commands, shell scripts, or malicious phishing links.
- **Resolution:**
  - `sanitizeAIText` strips executable shell delimiters, script tags, SQL keywords, and external arbitrary URLs.
  - An AI response is strictly a **proposal** that the user must review, select, and approve.
  - Tasks are constructed solely through the domain's validated `CreateTask` use case.

---

## 3. Residual Risk & Operational Considerations

1. **Rooted / Jailbroken Devices:**
   - On rooted Android devices, users with root shell can inspect the SQLite database file (`/data/data/com.momentum.app/databases`). This is standard for local-first apps.
   - For enterprise deployments requiring encryption at rest on rooted devices, SQLCipher can be introduced.
2. **Third-Party AI Outages:**
   - If the Gemini API experiences an outage or quota exhaustion, Momentum gracefully falls back to deterministic rule-based local goal decomposition without blocking ordinary task creation.
3. **Upstream Dev-Tooling Vulnerability (node-forge in @expo/cli):**
   - `npm audit` identifies `GHSA-86w9-cpqp-85rv` in `node-forge` (used by `@expo/code-signing-certificates` inside `@expo/cli` during local build code-signing).
   - **Zero Runtime Impact:** `node-forge` is exclusively a build-tooling dependency of Expo CLI and is **never** bundled into the client application runtime or Android APK.
   - Application-level `zod` has been fully patched to `^4.6.7` via `package.json` overrides.
   - Forcing an audit downgrade would break Expo SDK 58 and React Native 0.88; awaiting upstream patch release from `node-forge`. Production build isolation ensures client device safety.
