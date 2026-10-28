import { create } from 'zustand';
import { AuthUser, AuthSession } from '../../services/auth/IAuthService';
import { ServiceContainer } from '../../services/ServiceContainer';

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  // Explicit merge confirmation dialog
  showMergePrompt: boolean;
  pendingSyncAfterLogin: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (email: string, pass: string, displayName?: string) => Promise<{ success: boolean; requiresConfirmation: boolean }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  continueAsGuest: () => void;
  confirmMerge: () => Promise<void>;
  declineMerge: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isGuest: true,
  isLoading: true,
  error: null,
  showMergePrompt: false,
  pendingSyncAfterLogin: false,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      const authService = ServiceContainer.getInstance().getAuthService();
      const session = await authService.getSession();
      if (session) {
        set({
          session,
          user: session.user,
          isGuest: false,
          isLoading: false,
        });
      } else {
        set({
          session: null,
          user: null,
          isGuest: true,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false, isGuest: true });
    }
  },

  login: async (email: string, pass: string) => {
    try {
      set({ isLoading: true, error: null });
      const authService = ServiceContainer.getInstance().getAuthService();
      const { session, user } = await authService.signIn(email, pass);

      // Check if there are local tasks that might need merging
      const taskRepo = ServiceContainer.getInstance().getTaskRepository();
      const localTasks = await taskRepo.findAll();

      if (localTasks.length > 0) {
        // Show prompt asking explicit confirmation to upload local guest tasks
        set({
          session,
          user,
          isGuest: false,
          isLoading: false,
          showMergePrompt: true,
          pendingSyncAfterLogin: true,
        });
      } else {
        set({
          session,
          user,
          isGuest: false,
          isLoading: false,
        });
        // Trigger initial cloud pull
        ServiceContainer.getInstance().getSyncEngine().sync();
      }
      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Login failed' });
      return false;
    }
  },

  register: async (email: string, pass: string, displayName?: string) => {
    try {
      set({ isLoading: true, error: null });
      const authService = ServiceContainer.getInstance().getAuthService();
      const res = await authService.signUp(email, pass, displayName);

      if (res.user && !res.requiresEmailConfirmation) {
        // Logged in automatically
        const taskRepo = ServiceContainer.getInstance().getTaskRepository();
        const localTasks = await taskRepo.findAll();

        set({
          user: res.user,
          isGuest: false,
          isLoading: false,
          showMergePrompt: localTasks.length > 0,
          pendingSyncAfterLogin: localTasks.length > 0,
        });
      } else {
        set({ isLoading: false });
      }

      return { success: true, requiresConfirmation: res.requiresEmailConfirmation };
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Registration failed' });
      return { success: false, requiresConfirmation: false };
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      const authService = ServiceContainer.getInstance().getAuthService();
      await authService.signOut();
      set({
        user: null,
        session: null,
        isGuest: true,
        isLoading: false,
        showMergePrompt: false,
        pendingSyncAfterLogin: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Logout failed' });
    }
  },

  resetPassword: async (email: string) => {
    try {
      set({ isLoading: true, error: null });
      const authService = ServiceContainer.getInstance().getAuthService();
      await authService.resetPassword(email);
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Password reset request failed' });
      return false;
    }
  },

  continueAsGuest: () => {
    set({
      isGuest: true,
      error: null,
      showMergePrompt: false,
    });
  },

  confirmMerge: async () => {
    set({ showMergePrompt: false, pendingSyncAfterLogin: false });
    // Queue all existing local tasks into the sync outbox
    const syncEngine = ServiceContainer.getInstance().getSyncEngine();
    await syncEngine.enqueueAllLocalTasksForInitialSync();
    await syncEngine.sync();
  },

  declineMerge: () => {
    set({ showMergePrompt: false, pendingSyncAfterLogin: false });
    // Pull remote tasks or keep local tasks independent
    const syncEngine = ServiceContainer.getInstance().getSyncEngine();
    syncEngine.sync();
  },

  clearError: () => set({ error: null }),
}));
