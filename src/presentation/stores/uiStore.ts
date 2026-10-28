/**
 * Zustand store for transient UI state only.
 * NOT a source of truth for tasks — that's SQLite.
 */

import { create } from 'zustand';

interface UIState {
  /** Currently active task filter tab */
  activeFilter: 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';
  setActiveFilter: (filter: UIState['activeFilter']) => void;

  /** Search query in the tasks list */
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  /** Whether quick add bar is expanded */
  quickAddExpanded: boolean;
  setQuickAddExpanded: (expanded: boolean) => void;

  /** Whether onboarding has been completed */
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;

  /** Global revision counter for reactive task list updates */
  tasksRevision: number;
  incrementTasksRevision: () => void;

  /** Snackbar/toast message */
  snackbar: { message: string; type: 'success' | 'error' | 'info' } | null;
  showSnackbar: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideSnackbar: () => void;
}

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getInitialOnboarding = (): boolean => {
  if (isWeb) {
    try {
      const v = window.localStorage.getItem('momentum_onboarding_version');
      if (v === '1') return true;
      return window.localStorage.getItem('momentum_onboarding_complete') === 'true';
    } catch {
      return false;
    }
  }
  return false;
};

export const useUIStore = create<UIState>((set) => ({
  activeFilter: 'all',
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  quickAddExpanded: false,
  setQuickAddExpanded: (expanded) => set({ quickAddExpanded: expanded }),

  onboardingComplete: getInitialOnboarding(),
  setOnboardingComplete: (complete) => {
    if (isWeb) {
      try {
        window.localStorage.setItem('momentum_onboarding_version', complete ? '1' : '0');
        window.localStorage.setItem('momentum_onboarding_complete', complete ? 'true' : 'false');
      } catch {
        // Ignore storage errors in restricted contexts
      }
    }
    set({ onboardingComplete: complete });
  },

  tasksRevision: 0,
  incrementTasksRevision: () => set((s) => ({ tasksRevision: s.tasksRevision + 1 })),

  snackbar: null,
  showSnackbar: (message, type = 'info') => {
    set({ snackbar: { message, type } });
    // Auto-hide after 3 seconds
    setTimeout(() => set({ snackbar: null }), 3000);
  },
  hideSnackbar: () => set({ snackbar: null }),
}));
