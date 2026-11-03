/**
 * Hook for create/edit task form state management.
 * Handles validation, submission, error display, and task-specific daily reminder scheduling.
 */

import { useState, useCallback } from 'react';
import { CreateTaskInput, UpdateTaskInput } from '../../domain/entities/Task';
import { Task } from '../../domain/entities/Task';
import { useServices } from './useServices';
import { TaskValidationError } from '../../domain/use-cases/CreateTask';
import { useUIStore } from '../stores/uiStore';
import { ReminderFrequency } from '../components/TaskReminderPicker';

export interface FormState {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMPORTANT';
  energyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedDurationMinutes: string;
  deadline: string;
  deadlineTimezone: string;
  tags: string[];
  tagInput: string;
  subtasks: { title: string; isCompleted: boolean }[];
  subtaskInput: string;
  reminderEnabled: boolean;
  reminderTime: string; // "HH:MM" e.g. "19:00"
  reminderFrequency: ReminderFrequency;
}

export interface FormErrors {
  title?: string;
  description?: string;
  estimatedDurationMinutes?: string;
  deadline?: string;
  general?: string;
}

export interface UseTaskFormResult {
  form: FormState;
  errors: FormErrors;
  submitting: boolean;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  addSubtask: () => void;
  removeSubtask: (index: number) => void;
  toggleSubtask: (index: number) => void;
  submit: () => Promise<Task | null>;
  reset: () => void;
  loadTask: (task: Task) => void;
}

const initialFormState: FormState = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  energyLevel: 'MEDIUM',
  estimatedDurationMinutes: '',
  deadline: '',
  deadlineTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tags: [],
  tagInput: '',
  subtasks: [],
  subtaskInput: '',
  reminderEnabled: false,
  reminderTime: '19:00',
  reminderFrequency: 'DAILY',
};

export function useTaskForm(editTaskId?: string): UseTaskFormResult {
  const services = useServices();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (field in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  }, [errors]);

  const addTag = useCallback(() => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag) && form.tags.length < 20) {
      setForm((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
        tagInput: '',
      }));
    }
  }, [form.tagInput, form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }, []);

  const addSubtask = useCallback(() => {
    const title = form.subtaskInput.trim();
    if (title && form.subtasks.length < 100) {
      setForm((prev) => ({
        ...prev,
        subtasks: [...prev.subtasks, { title, isCompleted: false }],
        subtaskInput: '',
      }));
    }
  }, [form.subtaskInput, form.subtasks]);

  const removeSubtask = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== index),
    }));
  }, []);

  const toggleSubtask = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s, i) =>
        i === index ? { ...s, isCompleted: !s.isCompleted } : s,
      ),
    }));
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    const trimmedTitle = form.title.trim();

    if (!trimmedTitle) {
      newErrors.title = 'Title is required';
    } else if (trimmedTitle.length > 500) {
      newErrors.title = 'Title must be 500 characters or less';
    }

    if (form.description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less';
    }

    if (form.estimatedDurationMinutes) {
      const duration = parseInt(form.estimatedDurationMinutes, 10);
      if (isNaN(duration) || duration < 1 || duration > 1440) {
        newErrors.estimatedDurationMinutes = 'Duration must be 1-1440 minutes';
      }
    }

    if (form.deadline) {
      const deadlineDate = new Date(form.deadline);
      if (isNaN(deadlineDate.getTime())) {
        newErrors.deadline = 'Invalid date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const submit = useCallback(async (): Promise<Task | null> => {
    if (!validate()) return null;

    setSubmitting(true);
    try {
      const durationStr = form.estimatedDurationMinutes.trim();
      const duration = durationStr ? parseInt(durationStr, 10) : null;

      let savedTask: Task;

      if (editTaskId) {
        // Update existing task
        const updateInput: UpdateTaskInput = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          energyLevel: form.energyLevel,
          estimatedDurationMinutes: isNaN(duration as number) ? null : duration,
          deadline: form.deadline || null,
          deadlineTimezone: form.deadline ? form.deadlineTimezone : null,
          tags: form.tags,
        };
        savedTask = await services.updateTask.execute(editTaskId, updateInput);
      } else {
        // Create new task
        const createInput: CreateTaskInput = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          energyLevel: form.energyLevel,
          estimatedDurationMinutes: isNaN(duration as number) ? null : duration,
          deadline: form.deadline || null,
          deadlineTimezone: form.deadline ? form.deadlineTimezone : null,
          tags: form.tags,
          subtasks: form.subtasks.map((s) => ({ title: s.title })),
        };
        savedTask = await services.createTask.execute(createInput);
      }

      // Schedule or update Task-Specific Daily Reminder
      if (services.createReminder && services.reminderRepository) {
        try {
          if (form.reminderEnabled && form.reminderTime) {
            // Cancel existing reminders for this task to avoid duplicates
            const existingReminders = await services.reminderRepository.findByTaskId(savedTask.id);
            for (const rem of existingReminders) {
              if (services.cancelReminder) {
                await services.cancelReminder.execute(rem.id);
              }
            }

            // Calculate trigger timestamp
            const [h, m] = form.reminderTime.split(':').map((v) => parseInt(v, 10));
            const trigger = new Date();
            trigger.setHours(h, m, 0, 0);
            const now = new Date();
            if (trigger.getTime() <= now.getTime()) {
              trigger.setDate(trigger.getDate() + 1); // Next daily occurrence tomorrow
            }

            let recurrenceRule: any = null;
            if (form.reminderFrequency === 'DAILY') {
              recurrenceRule = { frequency: 'DAILY', interval: 1 };
            } else if (form.reminderFrequency === 'WEEKDAYS') {
              recurrenceRule = { frequency: 'WEEKLY', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] };
            }

            await services.createReminder.execute({
              taskId: savedTask.id,
              type: form.reminderFrequency === 'ONCE' ? 'ONE_TIME' : 'RECURRING',
              triggerTime: trigger.toISOString(),
              recurrenceRule,
              isNagEnabled: false,
            });
          } else if (!form.reminderEnabled && editTaskId) {
            // User disabled reminder on existing task
            const existingReminders = await services.reminderRepository.findByTaskId(savedTask.id);
            for (const rem of existingReminders) {
              if (services.cancelReminder) {
                await services.cancelReminder.execute(rem.id);
              }
            }
          }
        } catch (reminderErr) {
          console.warn('[useTaskForm] Reminder scheduling notice:', reminderErr);
        }
      }

      useUIStore.getState().incrementTasksRevision();
      return savedTask;
    } catch (err) {
      if (err instanceof TaskValidationError) {
        setErrors({ general: err.errors.join('; ') });
      } else {
        setErrors({ general: err instanceof Error ? err.message : 'Failed to save task' });
      }
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [form, editTaskId, services, validate]);

  const reset = useCallback(() => {
    setForm(initialFormState);
    setErrors({});
  }, []);

  const loadTask = useCallback(async (task: Task) => {
    let reminderEnabled = false;
    let reminderTime = '19:00';
    let reminderFrequency: ReminderFrequency = 'DAILY';

    if (services.reminderRepository) {
      try {
        const active = await services.reminderRepository.findByTaskId(task.id);
        const scheduled = active.find((r) => r.status === 'SCHEDULED' || r.status === 'SNOOZED');
        if (scheduled) {
          reminderEnabled = true;
          const d = new Date(scheduled.triggerTime);
          if (!isNaN(d.getTime())) {
            reminderTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          }
          if (scheduled.recurrenceRule?.daysOfWeek && scheduled.recurrenceRule.daysOfWeek.length === 5) {
            reminderFrequency = 'WEEKDAYS';
          } else if (scheduled.type === 'ONE_TIME') {
            reminderFrequency = 'ONCE';
          } else {
            reminderFrequency = 'DAILY';
          }
        }
      } catch {
        // Handled safely
      }
    }

    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      energyLevel: task.energyLevel,
      estimatedDurationMinutes: task.estimatedDurationMinutes?.toString() ?? '',
      deadline: task.deadline ?? '',
      deadlineTimezone: task.deadlineTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      tags: task.tags,
      tagInput: '',
      subtasks: task.subtasks.map((s) => ({ title: s.title, isCompleted: s.isCompleted })),
      subtaskInput: '',
      reminderEnabled,
      reminderTime,
      reminderFrequency,
    });
    setErrors({});
  }, [services]);

  return {
    form,
    errors,
    submitting,
    updateField,
    addTag,
    removeTag,
    addSubtask,
    removeSubtask,
    toggleSubtask,
    submit,
    reset,
    loadTask,
  };
}
