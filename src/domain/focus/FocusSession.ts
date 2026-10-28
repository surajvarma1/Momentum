/**
 * Focus Session entity and lifecycle state definitions.
 */

export const FocusState = {
  IDLE: 'IDLE',
  FOCUSING: 'FOCUSING',
  PAUSED: 'PAUSED',
  BREAK: 'BREAK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type FocusState = (typeof FocusState)[keyof typeof FocusState];

export interface FocusSession {
  readonly id: string;
  readonly taskId: string | null;
  readonly state: FocusState;
  readonly targetDurationMs: number;
  readonly breakDurationMs: number;
  readonly startTime: string; // ISO 8601 UTC
  readonly pauseTime: string | null; // ISO 8601 UTC
  readonly accumulatedPausedMs: number;
  readonly completedAt: string | null; // ISO 8601 UTC
  readonly cancelledAt: string | null; // ISO 8601 UTC
  readonly actualFocusDurationMs: number;
  readonly notes: string | null;
  readonly interruptionLogged: boolean;
  readonly interruptionReason: string | null;
  readonly createdAt: string; // ISO 8601 UTC
  readonly updatedAt: string; // ISO 8601 UTC
}

export interface StartFocusSessionInput {
  taskId?: string | null;
  targetDurationMs?: number; // default 25 min (1,500,000 ms)
  breakDurationMs?: number;  // default 5 min (300,000 ms)
  notes?: string | null;
}
