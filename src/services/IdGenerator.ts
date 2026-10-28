/**
 * ID generator interface and implementations.
 * Production uses crypto.randomUUID via expo-crypto.
 * Tests can use deterministic sequential IDs.
 */

export interface IIdGenerator {
  generate(): string;
}

/**
 * Production ID generator using crypto.randomUUID.
 * Uses the global crypto API available in modern React Native/Hermes.
 */
export class UUIDGenerator implements IIdGenerator {
  generate(): string {
    // crypto.randomUUID is available in Hermes engine (React Native 0.86+)
    // Falls back to a manual implementation if not available
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    // Fallback: manual UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Deterministic ID generator for testing.
 * Generates sequential predictable IDs.
 */
export class TestIdGenerator implements IIdGenerator {
  private counter = 0;
  private readonly prefix: string;

  constructor(prefix: string = 'test') {
    this.prefix = prefix;
  }

  generate(): string {
    this.counter += 1;
    return `${this.prefix}-${String(this.counter).padStart(4, '0')}`;
  }

  reset(): void {
    this.counter = 0;
  }
}
