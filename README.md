# Momentum — Enterprise Offline-First Productivity Engine

> **Tagline:** Build momentum. Crush your goals.  
> **Brand:** Momentum (Android-first, offline-first task management, focus arena, reliable reminders & secure cloud sync)  
> **Current Version:** Momentum 3.0.0 (Release Candidate)

---

## 🌟 Overview

**Momentum** is a high-performance, offline-first mobile productivity engine built with Clean Architecture, strict domain validation, and secure cloud synchronization. Designed with a charcoal/ink visual language and violet accents, Momentum combines a structured task hierarchy with deterministic local reminders, an accountable Focus Arena, proactive missed-task recovery, and server-side AI goal decomposition.

---

## 🧱 Architecture & Design Principles

- **Clean Architecture & MVVM:** Strict separation of layers:
  - **Domain:** Pure TypeScript entities (`Task`, `Subtask`, `Reminder`, `FocusSession`, `MissedTaskRecord`), value objects, pure engines (`RecurrenceScheduler`, `FocusStateMachine`, `MissedTaskRecoveryEngine`, `AnalyticsEngine`), and use cases.
  - **Data:** SQLite persistence with versioned migrations (`schema_version`), parameterized queries, atomic transactions, and repository implementations (`SQLiteTaskRepository`, `SQLiteReminderRepository`, `SQLiteFocusSessionRepository`, `SQLiteMissedTaskRepository`, `SQLiteSyncRepository`).
  - **Presentation:** Expo Router file-based routing, MVVM view models via custom hooks, design tokens with dark/light theme support, and reusable components.
  - **Services:** Dependency injection container (`ServiceContainer`) with native `NotificationService` (Android channels, inexact triggers, reconciliation), `SyncEngine` (offline-first outbox), `SupabaseAuthService` (SecureStore token handling), and `SupabaseAIDecomposerService`.
- **Single Source of Truth:** Local SQLite is the immediate source of truth. All user mutations write locally first.
- **Hardware-Backed Token Security:** Refresh tokens are stored in Keychain/Keystore via `expo-secure-store` with `AFTER_FIRST_UNLOCK` accessibility.
- **Cloud Row Level Security (RLS):** Every exposed PostgreSQL table enforces strict RLS where `auth.uid() = user_id`.

---

## 📱 Features & Screens Implemented

### Phase 1 Core Task Management
1. **Onboarding:** Explains offline-first local storage and optional cloud sync.
2. **Today Dashboard:** Daily progress ring, high/important priority items, overdue task banner, next suggested focus task, and inline quick-add.
3. **All Tasks:** Filter chips (`All`, `Today`, `Upcoming`, `Overdue`, `Completed`), search filter, task card checkoff, and pull-to-refresh.
4. **Planner Screen:** Maps upcoming commitments over the next 7 days and organizes unscheduled backlogs.
5. **Task Create / Edit:** Comprehensive forms with validation, subtask checklist management, tag chips, energy levels, and duration.
6. **Task Details:** Full task breakdown, subtask toggling, status transition controls (complete, reopen, cancel), reminders card with 15m pre-deadline alert and snooze controls, and deletion confirmation dialog.

### Phase 2 Momentum Upgrades
7. **Reliable Local Reminders:**
   - One-time reminders, deadline offsets (e.g., 15m, 1h prior), and recurring schedules (daily, weekly with specific weekdays, monthly, yearly).
   - Impossible date handling: monthly recurrence on 31st clamps to 30th on 30-day months (e.g. April 30) or Feb 28/29 while preserving the 31st configuration for subsequent months.
   - Configurable Quiet Hours (e.g., 22:00 to 07:00); reminders shift to the end of quiet hours.
   - Opt-in Bounded Nag Mode (default: 3 repeat alerts/day at 15-minute intervals). No infinite loops.
   - Native Android channels (`momentum_reminders`, `momentum_nag`) via `expo-notifications`.
   - Automatic cleanup of native alarms when tasks are completed, cancelled, or deleted.
8. **Interactive Focus Arena:**
   - Deterministic state machine: `IDLE -> FOCUSING -> PAUSED -> BREAK -> COMPLETED`.
   - Timestamp-based elapsed duration calculation: never loses accuracy during app suspension.
   - AppState lifecycle observation: backgrounding is **never** counted as a session failure.
   - Empathetic interruption check: prompts the user upon return to record external distractions without punitive penalties.
9. **Accountability & Missed-Task Recovery:**
   - Overdue task banner on the Today screen suggesting realistic reschedules (today at 18:00 if morning; tomorrow at 09:00 if evening).
   - Reflection reason requirement for `HIGH` and `IMPORTANT` tasks when enabled by user preference.
10. **Velocity & Deterministic Analytics:**
    - Timezone-aware streak counter with a 1-day grace period based strictly on verified task completions.
    - Real focus velocity tracking without fabricated vanity scores.

### Phase 3 Cloud Sync & AI Goal Decomposer
11. **Supabase Authentication & Guest Mode:**
    - Sign in, sign up, logout, password recovery, session restoration.
    - Explicit local task merge confirmation dialog: guest tasks are **never** silently uploaded.
12. **Offline-First Synchronization (`SyncEngine`):**
    - SQLite `sync_outbox` buffers mutations when offline.
    - `sync_tombstones` prevents deleted tasks from unexpectedly resurrecting upon pulling remote changes.
    - Bounded exponential backoff with random jitter.
    - Connectivity-aware synchronization triggered automatically when network is restored.
13. **AI Goal Decomposer (`ai-decompose`):**
    - Supabase Edge Function with Bytez (`Qwen/Qwen3-4B`) inference.
    - Bytez credentials are read from the Edge Function environment and are never sent by the client.
    - JWT verified caller identity; 20 request/day quota enforced in PostgreSQL.
    - Prompt safety sanitizer neutralizes script tags, SQL injection, and external URLs.
    - Untrusted Proposal Review Screen: user reviews, selects, and approves proposed tasks before creation.
    - Provider requests stay on the authenticated server; unavailable service errors are surfaced to the user.
14. **Security & Production Hardening:**
    - No provider credentials bundled in the client APK; `BYTEZ_API_KEY` may be configured as an Edge Function secret.
    - Target SDK configured for Android 16 (API 36) complying with published Google Play 2026 standards.
    - GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** v20.x or higher (tested on Node v24.17.0)
- **npm:** v10.x or higher (tested on npm 11.13.0)
- **Expo CLI:** Bundled with project

### Installation

```bash
# Navigate to the app directory
cd momentum

# Install dependencies
npm install
```

### Configure Bytez AI

The Bytez key belongs only in the Supabase Edge Function environment, not in an Expo `.env` file or any `EXPO_PUBLIC_` variable. The client never accepts or sends provider credentials.

1. Copy `supabase/.env.example` to `supabase/.env` and set `BYTEZ_API_KEY` to your Bytez key. This local file is git-ignored.
2. To run the function locally:

   ```bash
   supabase functions serve ai-decompose --env-file supabase/.env
   ```

3. For a deployed Supabase project, link the project and upload the key and selected model as Edge Function secrets, then deploy:

   ```bash
   supabase link --project-ref your-project-ref
   supabase secrets set --env-file supabase/.env
   supabase functions deploy ai-decompose
   ```

Do not commit `supabase/.env` or paste the key into the app.
The deployment command updates the server model from the env file to `Qwen/Qwen3-4B`; redeploy the Edge Function after changing the model or provider request code.

### Running the App

```bash
# Start Expo development server
npm run start

# Launch on Android emulator or connected device
npm run android

# Launch on Web preview
npm run web
```

### Quality Gate Commands

```bash
# Run all 13 automated test suites (144 tests passing)
npm test

# Run TypeScript strict type verification (0 errors)
npm run typecheck

# Run Expo configuration diagnostics (20/20 checks passed)
npx expo-doctor

# Run dependency audit
npm audit
```

---

## 📚 Documentation Index

- [Product Requirements Document](docs/product-requirements.md)
- [Architecture Document](docs/architecture.md)
- [Data Model & Schema Migrations](docs/data-model.md)
- [Testing Strategy & Test Coverage Report](docs/testing.md)
- [Security Threat Model](docs/security/threat-model.md)
- [Security Audit Findings Report](docs/security/audit-findings.md)
- [Privacy Policy & Data Safety Disclosures](docs/privacy-policy.md)
- [Google Play Store Release & Rollout Checklist](docs/store-release-checklist.md)
- [ADR 0001: Application Architecture](docs/adr/0001-application-architecture.md)
- [ADR 0002: Reliable Reminders and Focus Engine](docs/adr/0002-reliable-reminders-and-focus-engine.md)
- [ADR 0003: Secure Cloud Sync and AI Architecture](docs/adr/0003-secure-cloud-sync-and-ai-architecture.md)
