let SecureStore: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
} catch {
  // Graceful fallback for non-native / test environments
}

/**
 * Custom Storage Adapter for Supabase Auth in Expo.
 * Uses expo-secure-store on native platforms to securely store JWTs and refresh tokens.
 * Falls back to an in-memory or web localStorage mechanism to ensure safety and testability.
 */
class SecureAuthStorageAdapter {
  private memoryStore: Map<string, string> = new Map();

  private isWeb(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async getItem(key: string): Promise<string | null> {
    try {
      if (this.isWeb()) {
        return window.localStorage.getItem(key);
      }
      if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
        return await SecureStore.getItemAsync(key);
      }
      return this.memoryStore.get(key) || null;
    } catch {
      return this.memoryStore.get(key) || null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (this.isWeb()) {
        window.localStorage.setItem(key, value);
        return;
      }
      if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
        return;
      }
      this.memoryStore.set(key, value);
    } catch {
      this.memoryStore.set(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (this.isWeb()) {
        window.localStorage.removeItem(key);
        return;
      }
      if (SecureStore && typeof SecureStore.deleteItemAsync === 'function') {
        await SecureStore.deleteItemAsync(key);
        return;
      }
      this.memoryStore.delete(key);
    } catch {
      this.memoryStore.delete(key);
    }
  }
}

export const SecureAuthStorage = new SecureAuthStorageAdapter();
