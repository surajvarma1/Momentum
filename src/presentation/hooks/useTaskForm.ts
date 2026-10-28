/**
 * Hook for create/edit task form state management.
 * Handles validation, submission, and error display.
 */

import { useState, useCallback } from 'react';
import { CreateTaskInput, UpdateTaskInput } from '../../domain/entities/Task';
import { Task } from '../../domain/entities/Task';
import { useServices } from './useServices';
import { TaskValidationError } from '../../domain/use-cases/CreateTask';
import { useUIStore } from '../stores/uiStore';

interface FormState {
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
}

interface FormErrors {
  title?: string;
  description?: string;
  estimatedDurationMinutes?: string;
  deadline?: string;
  general?: string;
}

interface UseTaskFormResult {
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
        const updated = await services.updateTask.execute(editTaskId, updateInput);
        useUIStore.getState().incrementTasksRevision();
        return updated;
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
        const created = await services.createTask.execute(createInput);
        useUIStore.getState().incrementTasksRevision();
        return created;
      }
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

  const loadTask = useCallback((task: Task) => {
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
    });
    setErrors({});
  }, []);

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
