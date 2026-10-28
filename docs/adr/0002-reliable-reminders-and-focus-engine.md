# ADR 0002: Reliable Reminders, Focus Arena State Machine, and Accountability

## Status
Accepted

## Context
In Phase 2 of Momentum, we require:
1. A production-minded local reminder engine with recurrence (daily, weekly, monthly impossible date clamping, leap years) and quiet hours.
2. Native notification scheduling with permission handling, Android channels, and automatic cleanup.
3. A Focus Arena timer that accurately tracks focus sessions across mobile backgrounding and app restarts.
4. Accountability behavior for missed/overdue tasks without penalizing ordinary app minimization.
5. Deterministic analytics without vanity metrics.

## Decisions

### 1. Separation of Pure Recurrence Math from Platform APIs
- `RecurrenceScheduler` is implemented as a pure, zero-dependency domain service.
- All date calculations are executed in UTC to avoid platform-specific timezone drifts and DST calculation ambiguities.
- Monthly recurrence on impossible dates (e.g. 31st on April or February) clamps to the last day of the target month (April 30, Feb 28/29) while preserving the original `dayOfMonth` configuration for subsequent months (May 31).
- Native Expo Notifications (`NotificationService`) consumes timestamps produced by `RecurrenceScheduler`.

### 2. Inexact Alarms and Bounded Repeat Reminders
- We do not request `SCHEDULE_EXACT_ALARM` permissions by default, adhering to Android battery conservation standards.
- Nag Mode is strictly opt-in and bounded by a user-configurable ceiling (default: 3 repeat alerts per day at 15-minute intervals). No infinite notification loops exist.
- Dedicated Android notification channels (`momentum_reminders` and `momentum_nag`) provide user control over notification presentation.

### 3. Timestamp-Driven Focus Arena State Machine
- `setInterval` is never used to track elapsed focus time because mobile OSes suspend JavaScript intervals when the app is backgrounded.
- Focus elapsed time is derived from the difference between timestamps:
  $$\text{elapsed} = (\text{now} - \text{startTime}) - \text{accumulatedPausedMs}$$
- Lifecycle events (`AppState` background/active) are observed purely as state hints. Moving the app to background does **not** fail, pause, or abandon the session.
- An optional interruption dialog greets the user upon return, asking empathetically whether an external distraction affected the session.

### 4. Missed-Task Recovery and Deferral Reflections
- Overdue tasks generate a recovery suggestion banner on the Today screen.
- Morning detections suggest rescheduling to today at 18:00; evening detections suggest rescheduling to tomorrow at 09:00.
- If the user has enabled the accountability preference, rescheduling or deferring a `HIGH` or `IMPORTANT` task prompts for a reflection note.
- Prompts are recorded in `missed_task_records` to prevent duplicate nagging on the same day.

### 5. Automated Notification Lifecycle Teardown
- Task domain use cases (`CompleteTask`, `CancelTask`, `DeleteTask`) automatically invoke `notificationService.cancelAllForTask(taskId)` and mark associated reminders as `CANCELLED` or `DISMISSED`.

## Consequences
- Completely testable offline logic with 100% deterministic unit test execution.
- Zero battery drain or alarm spam from unconstrained background timers.
- Resilient recovery across process termination, phone reboots, and app updates.
