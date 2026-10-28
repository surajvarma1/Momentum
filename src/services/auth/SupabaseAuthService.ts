import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabaseClient';
import { IAuthService, AuthUser, AuthSession, AuthStateChangeCallback } from './IAuthService';

export class SupabaseAuthService implements IAuthService {
  private client: SupabaseClient;
  private guestMode: boolean = true;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseClient();
  }

  isGuest(): boolean {
    return this.guestMode;
  }

  setGuest(isGuest: boolean): void {
    this.guestMode = isGuest;
  }

  async signUp(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ user: AuthUser | null; requiresEmailConfirmation: boolean }> {
    if (!isSupabaseConfigured()) {
      this.guestMode = false;
      const cleanEmail = email.trim().toLowerCase();
      const user: AuthUser = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        displayName: displayName || cleanEmail.split('@')[0],
        createdAt: new Date().toISOString(),
      };
      return { user, requiresEmailConfirmation: false };
    }

    const { data, error } = await this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      this.guestMode = false;
      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email || email,
        displayName: data.user.user_metadata?.display_name || displayName,
        createdAt: data.user.created_at,
      };
      const requiresConfirmation = !data.session;
      return { user, requiresEmailConfirmation: requiresConfirmation };
    }

    return { user: null, requiresEmailConfirmation: true };
  }

  async signIn(email: string, password: string): Promise<{ session: AuthSession; user: AuthUser }> {
    if (!isSupabaseConfigured()) {
      this.guestMode = false;
      const cleanEmail = email.trim().toLowerCase();
      const user: AuthUser = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0],
        createdAt: new Date().toISOString(),
      };
      const session: AuthSession = {
        accessToken: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        refreshToken: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        expiresAt: Math.floor(Date.now() / 1000) + 3600 * 24 * 30,
        user,
      };
      return { session, user };
    }

    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.session || !data.user) {
      throw new Error('Failed to start session. Please verify your credentials.');
    }

    this.guestMode = false;
    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email || email,
      displayName: data.user.user_metadata?.display_name,
      createdAt: data.user.created_at,
    };

    const session: AuthSession = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user,
    };

    return { session, user };
  }

  async signOut(): Promise<void> {
    this.guestMode = true;
    if (isSupabaseConfigured()) {
      try {
        await this.client.auth.signOut();
      } catch {
        // Safe fallback
      }
    }
  }

  async resetPassword(email: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) {
      throw new Error(error.message);
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;

    this.guestMode = false;
    return {
      id: data.user.id,
      email: data.user.email || '',
      displayName: data.user.user_metadata?.display_name,
      createdAt: data.user.created_at,
    };
  }

  async getSession(): Promise<AuthSession | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data } = await this.client.auth.getSession();
    if (!data.session || !data.session.user) return null;

    const user: AuthUser = {
      id: data.session.user.id,
      email: data.session.user.email || '',
      displayName: data.session.user.user_metadata?.display_name,
      createdAt: data.session.user.created_at,
    };

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user,
    };
  }

  onAuthStateChange(callback: AuthStateChangeCallback): () => void {
    if (!isSupabaseConfigured()) {
      return () => {};
    }

    const { data: { subscription } } = this.client.auth.onAuthStateChange(
      (_event, session) => {
        if (session && session.user) {
          this.guestMode = false;
          const user: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            displayName: session.user.user_metadata?.display_name,
            createdAt: session.user.created_at,
          };
          const authSession: AuthSession = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
            user,
          };
          callback(authSession, user);
        } else {
          this.guestMode = true;
          callback(null, null);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }
}
