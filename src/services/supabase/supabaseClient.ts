import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SecureAuthStorage } from '../auth/SecureAuthStorage';

let expoConstantsExtra: Record<string, any> | undefined;
try {
  // Dynamically require to avoid ESM issues in Jest / Node environment
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants');
  expoConstantsExtra = Constants.default?.expoConfig?.extra || Constants.expoConfig?.extra;
} catch {
  // Safely fallback when expo-constants is not loaded
}

const rawSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  expoConstantsExtra?.supabaseUrl ||
  'https://placeholder-project.supabase.co';

// Sanitize URL by stripping any /rest/v1 suffix or trailing slashes
const supabaseUrl = rawSupabaseUrl
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  expoConstantsExtra?.supabaseAnonKey ||
  'placeholder-anon-key';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL || expoConstantsExtra?.supabaseUrl) &&
    Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || expoConstantsExtra?.supabaseAnonKey)
  );
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!clientInstance) {
    const hasWebSocket = typeof globalThis !== 'undefined' && typeof (globalThis as any).WebSocket !== 'undefined';
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: SecureAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      ...(!hasWebSocket
        ? {
            realtime: {
              transport: class FallbackWebSocket {
                static readonly CONNECTING = 0;
                static readonly OPEN = 1;
                static readonly CLOSING = 2;
                static readonly CLOSED = 3;
                readyState = 1;
                addEventListener() {}
                removeEventListener() {}
                send() {}
                close() {}
              } as any,
            },
          }
        : {}),
    });
  }
  return clientInstance;
};

export const resetSupabaseClient = (customClient?: SupabaseClient): void => {
  clientInstance = customClient || null;
};
