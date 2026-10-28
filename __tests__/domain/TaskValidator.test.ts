/**
 * Tests for task validation and state transitions.
 */

import { validateCreateTaskInput, validateUpdateTaskInput, validateStatusTransition } from '../../src/domain/validation/TaskValidator';
import { TaskStatus, canTransition, isTerminal } from '../../src/domain/value-objects/TaskStatus';
import { Task } from '../../src/domain/entities/Task';

const NOW = '2026-01-15T10:00:00.000Z';
const FUTURE = '2026-02-15T10:00:00.000Z';
const PAST = '2025-12-01T10:00:00.000Z';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-001',
  title: 'Test Task',
  description: null,
  priority: 'MEDIUM',
  energyLevel: 'MEDIUM',
  status: 'PENDING',
  estimatedDurationMinutes: null,
  deadline: null,
  deadlineTimezone: null,
  tags: [],
  subtasks: [],
  recurrenceRule: null,
  createdAt: '2026-01-10T10:00:00.000Z',
  updatedAt: '2026-01-10T10:00:00.000Z',
  completedAt: null,
  cancelledAt: null,
  sortOrder: 0,
  ...overrides,
});

describe('Task Validation', () => {
  describe('validateCreateTaskInput', () => {
    it('accepts a valid minimal task', () => {
      const result = validateCreateTaskInput({ title: 'Buy groceries' }, NOW);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Buy groceries');
      }
    });

    it('accepts a fully populated task', () => {
      const result = validateCreateTaskInput(
        {
          title: 'Complete project',
          description: 'Finish the Phase 1 implementation',
          priority: 'HIGH',
          energyLevel: 'HIGH',
          estimatedDurationMinutes: 120,
          deadline: FUTURE,
          deadlineTimezone: 'America/New_York',
          tags: ['work', 'urgent'],
          subtasks: [{ title: 'Step 1' }, { title: 'Step 2' }],
        },
        NOW,
      );
      expect(result.success).toBe(true);
    });

    it('rejects empty title', () => {
      const result = validateCreateTaskInput({ title: '' }, NOW);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.includes('blank') || e.includes('must'))).toBe(true);
      }
    });

    it('rejects whitespace-only title', () => {
      const result = validateCreateTaskInput({ title: '   ' }, NOW);
      expect(result.success).toBe(false);
    });

    it('rejects title over 500 characters', () => {
      const result = validateCreateTaskInput({ title: 'a'.repeat(501) }, NOW);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.includes('500'))).toBe(true);
      }
    });

    it('accepts title of exactly 500 characters', () => {
      const result = validateCreateTaskInput({ title: 'a'.repeat(500) }, NOW);
      expect(result.success).toBe(true);
    });

    it('rejects description over 5000 characters', () => {
      const result = validateCreateTaskInput(
        { title: 'Test', description: 'a'.repeat(5001) },
        NOW,
      );
      expect(result.success).toBe(false);
    });

    it('rejects duration less than 1', () => {
      const result = validateCreateTaskInput(
        { title: 'Test', estimatedDurationMinutes: 0 },
        NOW,
      );
      expect(result.success).toBe(false);
    });

    it('rejects duration over 1440', () => {
      const result = validateCreateTaskInput(
        { title: 'Test', estimatedDurationMinutes: 1441 },
        NOW,
      );
      expect(result.success).toBe(false);
    });

    it('accepts duration of 1440 (24 hours)', () => {
      const result = validateCreateTaskInput(
        { title: 'Test', estimatedDurationMinutes: 1440 },
        NOW,
      );
      expect(result.success).toBe(true);
    });

    it('rejects deadline in the past for new tasks', () => {
      const result = validateCreateTaskInput(
        { title: 'Test', deadline: PAST },
        NOW,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.includes('future'))).toBe(true);
      }
    });

    it('accepts deadline in the future', () => {
      const result = validateCreateTaskInput(
        { title: 'Test', deadline: FUTURE },
        NOW,
      );
      expect(result.success).toBe(true);
    });

    it('rejects more than 20 tags', () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      const result = validateCreateTaskInput({ title: 'Test', tags }, NOW);
      expect(result.success).toBe(false);
    });

    it('rejects more than 100 subtasks', () => {
      const subtasks = Array.from({ length: 101 }, (_, i) => ({
        title: `Subtask ${i}`,
      }));
      const result = validateCreateTaskInput({ title: 'Test', subtasks }, NOW);
      expect(result.success).toBe(false);
    });

    it('rejects weekly recurrence without daysOfWeek', () => {
      const result = validateCreateTaskInput(
        {
          title: 'Test',
          recurrenceRule: { frequency: 'WEEKLY', interval: 1 },
        },
        NOW,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.includes('day'))).toBe(true);
      }
    });

    it('accepts weekly recurrence with daysOfWeek', () => {
      const result = validateCreateTaskInput(
        {
          title: 'Test',
          recurrenceRule: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [1, 3, 5] },
        },
        NOW,
      );
      expect(result.success).toBe(true);
    });

    it('trims title whitespace', () => {
      const result = validateCreateTaskInput({ title: '  Buy milk  ' }, NOW);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Buy milk');
      }
    });
  });

  describe('validateUpdateTaskInput', () => {
    it('accepts partial updates', () => {
      const task = makeTask();
      const result = validateUpdateTaskInput({ priority: 'HIGH' }, task, NOW);
      expect(result.success).toBe(true);
    });

    it('rejects empty title in update', () => {
      const task = makeTask();
      const result = validateUpdateTaskInput({ title: '' }, task, NOW);
      expect(result.success).toBe(false);
    });

    it('rejects past deadline in update', () => {
      const task = makeTask();
      const result = validateUpdateTaskInput({ deadline: PAST }, task, NOW);
      expect(result.success).toBe(false);
    });

    it('allows clearing deadline to null', () => {
      const task = makeTask({ deadline: FUTURE });
      const result = validateUpdateTaskInput({ deadline: null }, task, NOW);
      expect(result.success).toBe(true);
    });
  });
});

describe('Task State Machine', () => {
  describe('canTransition', () => {
    it('allows PENDING → IN_PROGRESS', () => {
      expect(canTransition('PENDING', 'IN_PROGRESS')).toBe(true);
    });

    it('allows PENDING → COMPLETED', () => {
      expect(canTransition('PENDING', 'COMPLETED')).toBe(true);
    });

    it('allows PENDING → CANCELLED', () => {
      expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('allows IN_PROGRESS → COMPLETED', () => {
      expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('allows IN_PROGRESS → CANCELLED', () => {
      expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
    });

    it('allows IN_PROGRESS → PENDING (pause)', () => {
      expect(canTransition('IN_PROGRESS', 'PENDING')).toBe(true);
    });

    it('allows COMPLETED → PENDING (reopen)', () => {
      expect(canTransition('COMPLETED', 'PENDING')).toBe(true);
    });

    it('allows CANCELLED → PENDING (reopen)', () => {
      expect(canTransition('CANCELLED', 'PENDING')).toBe(true);
    });

    it('disallows COMPLETED → IN_PROGRESS', () => {
      expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    });

    it('disallows COMPLETED → CANCELLED', () => {
      expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    });

    it('disallows CANCELLED → COMPLETED', () => {
      expect(canTransition('CANCELLED', 'COMPLETED')).toBe(false);
    });

    it('disallows CANCELLED → IN_PROGRESS', () => {
      expect(canTransition('CANCELLED', 'IN_PROGRESS')).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('COMPLETED is terminal', () => {
      expect(isTerminal('COMPLETED')).toBe(true);
    });

    it('CANCELLED is terminal', () => {
      expect(isTerminal('CANCELLED')).toBe(true);
    });

    it('PENDING is not terminal', () => {
      expect(isTerminal('PENDING')).toBe(false);
    });

    it('IN_PROGRESS is not terminal', () => {
      expect(isTerminal('IN_PROGRESS')).toBe(false);
    });
  });

  describe('validateStatusTransition', () => {
    it('returns success for valid transitions', () => {
      const result = validateStatusTransition('PENDING', 'COMPLETED');
      expect(result.success).toBe(true);
    });

    it('returns error for invalid transitions', () => {
      const result = validateStatusTransition('COMPLETED', 'CANCELLED');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Cannot transition');
      }
    });
  });
});
