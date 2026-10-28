/**
 * Zustand store for application settings (runtime cache).
 * Persisted to SQLite app_settings table.
 */

import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  /** Whether to show completed tasks in lists */
  showCompletedTasks: boolean;
  setShowCompletedTasks: (show: boolean) => void;

  /** Default task priority */
  defaultPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMPORTANT';
  setDefaultPriority: (priority: SettingsState['defaultPriority']) => void;

  /** Default estimated duration in minutes */
  defaultDuration: number;
  setDefaultDuration: (duration: number) => void;

  /** Reminder settings */
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;

  quietHoursStart: string; // "22:00"
  quietHoursEnd: string;   // "07:00"
  setQuietHours: (start: string, end: string) => void;

  /** Nag Mode (Opt-in bounded repeat reminders) */
  nagModeEnabled: boolean;
  setNagModeEnabled: (enabled: boolean) => void;

  maxNagRepeats: number;
  setMaxNagRepeats: (repeats: number) => void;

  /** Focus Arena settings */
  focusDurationMinutes: number;
  setFocusDurationMinutes: (mins: number) => void;

  breakDurationMinutes: number;
  setBreakDurationMinutes: (mins: number) => void;

  focusAccountabilityEnabled: boolean;
  setFocusAccountabilityEnabled: (enabled: boolean) => void;

  /** Accountability & Deferral reason */
  requireDeferralReason: boolean;
  setRequireDeferralReason: (required: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),

  showCompletedTasks: true,
  setShowCompletedTasks: (show) => set({ showCompletedTasks: show }),

  defaultPriority: 'MEDIUM',
  setDefaultPriority: (priority) => set({ defaultPriority: priority }),

  defaultDuration: 30,
  setDefaultDuration: (duration) => set({ defaultDuration: duration }),

  remindersEnabled: false,
  setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),

  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  setQuietHours: (start, end) => set({ quietHoursStart: start, quietHoursEnd: end }),

  nagModeEnabled: false,
  setNagModeEnabled: (enabled) => set({ nagModeEnabled: enabled }),

  maxNagRepeats: 3,
  setMaxNagRepeats: (repeats) => set({ maxNagRepeats: repeats }),

  focusDurationMinutes: 25,
  setFocusDurationMinutes: (mins) => set({ focusDurationMinutes: mins }),

  breakDurationMinutes: 5,
  setBreakDurationMinutes: (mins) => set({ breakDurationMinutes: mins }),

  focusAccountabilityEnabled: true,
  setFocusAccountabilityEnabled: (enabled) => set({ focusAccountabilityEnabled: enabled }),

  requireDeferralReason: false,
  setRequireDeferralReason: (required) => set({ requireDeferralReason: required }),
}));

// Clean up any legacy client-side stored API keys from localStorage
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  try {
    window.localStorage.removeItem('momentum_ai_api_key');
    window.localStorage.removeItem('momentum_ai_provider');
  } catch {
    // Best effort cleanup
  }
}
