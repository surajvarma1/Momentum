/**
 * Tests for task presentation logic, form inputs, validation schemas, and UI state invariants.
 */

import { validateCreateTaskInput, validateUpdateTaskInput } from '../../src/domain/validation/TaskValidator';

describe('Presentation Form Validation Rules', () => {
  const mockNow = '2026-10-25T12:00:00.000Z';

  it('validates required task title and rejects empty strings or whitespace', () => {
    const emptyResult = validateCreateTaskInput({ title: '' }, mockNow);
    expect(emptyResult.success).toBe(false);

    const whitespaceResult = validateCreateTaskInput({ title: '    ' }, mockNow);
    expect(whitespaceResult.success).toBe(false);

    const validResult = validateCreateTaskInput({ title: 'Fix architectural boundaries' }, mockNow);
    expect(validResult.success).toBe(true);
  });

  it('validates duration constraints between 1 and 1440 minutes', () => {
    const tooLow = validateCreateTaskInput({ title: 'Task', estimatedDurationMinutes: 0 }, mockNow);
    expect(tooLow.success).toBe(false);

    const tooHigh = validateCreateTaskInput({ title: 'Task', estimatedDurationMinutes: 1441 }, mockNow);
    expect(tooHigh.success).toBe(false);

    const validDuration = validateCreateTaskInput({ title: 'Task', estimatedDurationMinutes: 45 }, mockNow);
    expect(validDuration.success).toBe(true);
  });

  it('prevents scheduling new tasks with deadlines in the past', () => {
    const pastDeadline = validateCreateTaskInput(
      { title: 'Task', deadline: '2026-10-24T12:00:00.000Z' },
      mockNow
    );
    expect(pastDeadline.success).toBe(false);

    const futureDeadline = validateCreateTaskInput(
      { title: 'Task', deadline: '2026-10-26T12:00:00.000Z' },
      mockNow
    );
    expect(futureDeadline.success).toBe(true);
  });

  it('enforces maximum 20 tags per task', () => {
    const excessiveTags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const result = validateCreateTaskInput({ title: 'Task', tags: excessiveTags }, mockNow);
    expect(result.success).toBe(false);
  });

  it('enforces maximum 100 subtasks per task', () => {
    const excessiveSubtasks = Array.from({ length: 101 }, (_, i) => ({ title: `Subtask ${i}` }));
    const result = validateCreateTaskInput({ title: 'Task', subtasks: excessiveSubtasks }, mockNow);
    expect(result.success).toBe(false);
  });
});
