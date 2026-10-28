# ADR 0001: Use Clean Architecture with MVVM Presentation

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-10-23 |
| **Deciders** | Beast Mode Engineering Team |

---

## Context

We are building **Beast Mode**, an offline-first mobile productivity app targeting Android as the primary platform, built with Expo SDK 57, React Native 0.86, and TypeScript. The application will evolve through multiple phases:

- **Phase 1:** Offline-first task management with SQLite persistence
- **Phase 2:** Focus timer, reminders, recurrence execution, local notifications
- **Phase 3:** Cloud authentication, bidirectional sync, AI-powered task planning

The architecture must support:

1. **Offline-first operation** — all core functionality works without network connectivity
2. **Testability** — domain logic must be testable in isolation without React or SQLite dependencies
3. **Extensibility** — clean integration points for future cloud sync, AI services, and platform APIs
4. **Maintainability** — clear boundaries that prevent feature coupling as the codebase grows
5. **Swappable infrastructure** — ability to change persistence, AI providers, or sync mechanisms without rewriting business logic

---

## Decision

We adopt a **feature-oriented Clean Architecture** with four distinct layers and **MVVM** (Model-View-ViewModel) as the presentation pattern.

### Layer Structure

| Layer | Contents | Dependency Direction |
|-------|----------|---------------------|
| **Presentation** | Expo Router screens, React Native components, custom hooks (View Models), Zustand UI stores | Depends on Domain |
| **Domain** | Entities, value objects, Zod validation schemas, use case classes, repository interfaces | No external dependencies |
| **Data** | `DatabaseProvider`, `MigrationRunner`, `SQLiteTaskRepository` implementing `ITaskRepository` | Implements Domain interfaces |
| **Services** | `ClockService`, `ServiceContainer` (DI) | Injected across layers |

### Key Architectural Decisions

1. **Repository Pattern for Persistence**
   - Domain defines `ITaskRepository` interface
   - Data layer provides `SQLiteTaskRepository` implementation
   - Repositories are injected via `ServiceContainer`, enabling test doubles

2. **SQLite as Sole Source of Truth**
   - All persistent data lives in SQLite
   - No in-memory caches that could diverge from the database
   - Queries re-read from the database after mutations to ensure consistency

3. **Zustand for Transient UI State Only**
   - Zustand stores manage UI concerns: filter selections, form drafts, modal visibility, theme
   - Zustand is **never** used to store or cache domain data (tasks, subtasks)
   - This prevents data inconsistency between UI state and the SQLite database

4. **Custom Hooks as View Models**
   - Each screen has one or more custom hooks that encapsulate:
     - Use case invocation
     - Loading, error, and success state management
     - Data transformation for view consumption
   - Hooks bridge the React world (presentation) and the pure TypeScript world (domain)

5. **Use Cases as Business Operations**
   - Each business operation is a discrete use case class (e.g., `CreateTask`, `CompleteTask`)
   - Use cases validate input (via Zod), enforce business rules, and delegate persistence to repositories
   - Use cases are framework-agnostic and independently testable

6. **Dependency Injection via ServiceContainer**
   - `ServiceContainer` wires all dependencies at application startup
   - Injectable services (e.g., `ClockService`) enable deterministic testing
   - No global singletons; all dependencies are explicit

---

## Consequences

### Positive

- **Testable domain logic:** Use cases and validation are pure TypeScript — test without React, SQLite, or device APIs
- **Clear separation of concerns:** Each layer has a well-defined responsibility; changes in one layer don't cascade
- **Swappable infrastructure:** Can replace SQLite with a different database, add a cloud sync layer, or change AI providers without touching domain logic
- **Explicit data flow:** Screen → Hook → Use Case → Repository → SQLite is predictable and debuggable
- **Safe offline-first:** SQLite as single source of truth eliminates cache-vs-database inconsistency bugs
- **Scalable codebase:** New features (focus timer, reminders, AI) slot into existing layers without restructuring

### Negative

- **More files and boilerplate:** Clean Architecture introduces additional files (interfaces, use cases, repository implementations) compared to simpler patterns
- **Indirection:** Data flows through multiple layers, which can feel over-engineered for simple CRUD operations
- **Learning curve:** Contributors must understand the layered architecture and dependency rules

### Mitigations

- The application's scope (productivity app with planned AI/cloud features) justifies the architectural investment
- Consistent naming conventions and directory structure make navigation intuitive
- At Phase 1 scale (~10 screens, 1 entity), the boilerplate is manageable

---

## Alternatives Considered

### 1. Simple MVC (Model-View-Controller)

**Rejected.** While simpler to set up, MVC patterns in React Native tend to collapse into "fat controllers" (screens with embedded business logic). This makes the codebase difficult to test and resistant to change as features grow. Business logic becomes coupled to React lifecycle, preventing reuse.

### 2. Redux for Global State Management

**Rejected.** Redux introduces significant boilerplate (actions, reducers, selectors, middleware) that exceeds what this application requires. Redux is designed for complex shared state across many screens; Beast Mode's primary data flow is straightforward CRUD against a local database. Redux would also tempt storing task data in the Redux store, creating a cache-vs-database consistency problem.

### 3. Zustand as Primary Data Store

**Rejected.** Using Zustand to hold task data (treating it as an in-memory database with SQLite as a "backup") violates offline-first principles. On app restart, the Zustand store must be rehydrated from SQLite, creating a window for inconsistency. Two sources of truth (Zustand + SQLite) lead to subtle bugs: stale UI state after background operations, lost writes during rehydration, and complex synchronization logic. SQLite alone is more reliable and simpler.

---

## References

- Robert C. Martin, *Clean Architecture: A Craftsman's Guide to Software Structure and Design*
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Zustand — Bear Necessities for State Management](https://github.com/pmndrs/zustand)
