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

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  expoConstantsExtra?.supabaseUrl ||
  'https://placeholder-project.supabase.co';

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
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: SecureAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return clientInstance;
};

export const resetSupabaseClient = (customClient?: SupabaseClient): void => {
  clientInstance = customClient || null;
};
