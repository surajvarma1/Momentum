# Momentum — Architecture Document

> **Architecture Style:** Feature-Oriented Clean Architecture with MVVM Presentation  
> **Tech Stack:** Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript Strict · Expo Router · Expo SQLite · Supabase · Zustand · Zod · Expo Notifications · Expo SecureStore

---

## 1. System Architecture Overview

**Momentum** follows Clean Architecture principles adapted for offline-first resilience. The codebase is organized into distinct layers with strict dependency rules:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  Expo Router Screens · UI Components · MVVM Custom Hooks   │
│  Zustand Stores (Ephemeral UI drafts & filters only)        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    DOMAIN LAYER                       │  │
│  │  Entities: Task, Subtask, Reminder, FocusSession      │  │
│  │  Pure Domain Engines:                                 │  │
│  │  - RecurrenceScheduler (pure UTC date math)           │  │
│  │  - FocusStateMachine (timestamp-based duration)       │  │
│  │  - MissedTaskRecoveryEngine (realistic suggestions)   │  │
│  │  - AnalyticsEngine (streak & velocity computation)    │  │
│  │  - AIDecomposerSchemas & Text Sanitizer               │  │
│  │  Use Cases (Tasks, Reminders, Focus, Recovery, AI)    │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │                  DATA LAYER                     │  │  │
│  │  │  SQLite DB (Local single source of truth)       │  │  │
│  │  │  Migrations: 001_initial, 002_phase2, 003_phase3│  │  │
│  │  │  Repositories: SQLiteTask, SQLiteReminder,       │  │  │
│  │  │  SQLiteFocusSession, SQLiteMissedTask,          │  │  │
│  │  │  SQLiteSyncRepository                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     SERVICES LAYER                          │
│  SyncEngine · NotificationService · ClockService            │
│  SupabaseAuthService · SupabaseAIDecomposerService          │
│  SecureAuthStorageAdapter (Keychain/Keystore)               │
│  ServiceContainer (Dependency Injection)                    │
└─────────────────────────────────────────────────────────────┘
                               │ HTTPS / TLS 1.3
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD TIER                      │
│  Supabase Auth (JWT validation, refresh tokens)             │
│  Supabase Edge Functions: ai-decompose (Gemini inference)   │
│  PostgreSQL Database with Row Level Security (RLS)          │
│  - profiles, tasks, subtasks, focus_sessions, reminders,    │
│    sync_tombstones, ai_usage_quota                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Subsystems

### 2.1 Local-First Sync Engine (`SyncEngine`)
- **Single Source of Truth:** The local SQLite database is the immediate authority for the client. All user operations write synchronously to SQLite.
- **Outbox Architecture:** Mutations are enqueued to `sync_outbox`. When online, mutations are pushed in order with exponential backoff and jitter.
- **Tombstone Strategy:** Deleted tasks record entries in `sync_tombstones`. When pulling remote changes, tombstoned items are filtered out to prevent deleted tasks from resurrecting.
- **Concurrency & Conflicts:** Remote rows carry a `server_version` and `updated_at`. If an incoming update has a newer timestamp, remote state is applied; otherwise local changes prevail.

### 2.2 Secure Session Management (`SecureAuthStorage`)
- Session tokens are stored in hardware-backed secure storage via `expo-secure-store` with `AFTER_FIRST_UNLOCK` accessibility.
- Memory store fallback is utilized during unit testing to ensure isolation.

### 2.3 Edge-Isolated AI Architecture (`ai-decompose`)
- Gemini API keys are never bundled into the client application.
- The Supabase Edge Function validates incoming caller JWTs, derives identity via `auth.getUser()`, enforces a 20 request/day quota via `ai_usage_quota`, applies a 10 KB payload limit, and calls the Google Gemini API.
- All AI responses are sanitized using `sanitizeAIText` to neutralize potential script tags, SQL commands, and arbitrary URLs.
- AI output is presented on a review screen where users can inspect, modify, and selectively create tasks through standard domain use cases.

---

## 3. Directory Layout

```
momentum/
├── app/                          # Expo Router file-based pages
│   ├── (auth)/login.tsx          # Cloud sign-in, registration, guest toggle
│   ├── (tabs)/                   # Today, Tasks, Planner, Focus, Insights
│   ├── ai/decompose.tsx          # AI Goal Decomposer & Review screen
│   ├── settings/                 # General, Reminders, Account & Sync
│   ├── task/                     # Create, Edit, Details screens
│   └── _layout.tsx               # Root navigation stack & DI initialization
├── src/
│   ├── data/
│   │   ├── database/             # SQLite connection & MigrationRunner
│   │   ├── migrations/           # 001_initial, 002_phase2, 003_phase3
│   │   └── repositories/         # Task, Reminder, Focus, MissedTask, Sync repos
│   ├── domain/
│   │   ├── ai/                   # AIDecomposer schemas, sanitizers, interfaces
│   │   ├── entities/             # Task, Subtask
│   │   ├── focus/                # FocusSession, FocusStateMachine
│   │   ├── reminders/            # Reminder, RecurrenceScheduler
│   │   ├── sync/                 # SyncTypes (OutboxItem, Tombstone, Conflict)
│   │   └── use-cases/            # All typed domain operations
│   ├── presentation/
│   │   ├── components/           # Button, Card, Badge, Dialog, FormField
│   │   ├── hooks/                # useTasks, useFocusArena, useReminders, etc.
│   │   ├── stores/               # Zustand UI stores (authStore, uiStore)
│   │   └── theme/                # Design tokens & dark/light ThemeContext
│   ├── services/
│   │   ├── ai/                   # SupabaseAIDecomposerService
│   │   ├── auth/                 # SupabaseAuthService, SecureAuthStorage
│   │   ├── sync/                 # SyncEngine (offline-first push/pull)
│   │   ├── notifications/        # NotificationService (Android channels)
│   │   └── ServiceContainer.ts   # Dependency injection container
│   └── utils/
│       └── logger.ts             # Privacy-safe structured logger
├── supabase/
│   ├── functions/ai-decompose/   # Secure Deno Edge Function with Gemini
│   └── migrations/               # PostgreSQL schema & RLS policies
└── __tests__/                    # 13 Jest test suites (144 passing tests)
```
