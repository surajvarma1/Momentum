/**
 * Injectable clock service for deterministic testing.
 * Production implementation uses real system time.
 * Tests can inject a fixed or controllable clock.
 */

export interface IClock {
  /** Returns current time as ISO 8601 UTC string */
  now(): string;
}

export class SystemClock implements IClock {
  now(): string {
    return new Date().toISOString();
  }
}

/**
 * Fixed clock for deterministic testing.
 * Can be advanced manually.
 */
export class TestClock implements IClock {
  private currentTime: Date;

  constructor(fixedTime: string | Date = '2026-01-15T10:00:00.000Z') {
    this.currentTime = typeof fixedTime === 'string' ? new Date(fixedTime) : fixedTime;
  }

  now(): string {
    return this.currentTime.toISOString();
  }

  advance(milliseconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + milliseconds);
  }

  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }

  advanceHours(hours: number): void {
    this.advance(hours * 60 * 60 * 1000);
  }

  advanceDays(days: number): void {
    this.advance(days * 24 * 60 * 60 * 1000);
  }

  setTime(time: string | Date): void {
    this.currentTime = typeof time === 'string' ? new Date(time) : time;
  }
}
