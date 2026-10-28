export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  user: AuthUser;
}

export type AuthStateChangeCallback = (session: AuthSession | null, user: AuthUser | null) => void;

export interface IAuthService {
  signUp(email: string, password: string, displayName?: string): Promise<{ user: AuthUser | null; requiresEmailConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<{ session: AuthSession; user: AuthUser }>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: AuthStateChangeCallback): () => void;
  isGuest(): boolean;
  setGuest(isGuest: boolean): void;
}
