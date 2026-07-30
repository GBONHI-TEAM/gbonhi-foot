import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';

/**
 * On lit d'abord les variables `EXPO_PUBLIC_*` (injectées au bundle). Si elles
 * sont absentes (fréquent en monorepo Expo si le `.env` n'est pas pris en compte
 * → provoque « Network request failed » car l'URL devient `undefined`), on
 * retombe sur les constantes publiques du projet (URL + clé `anon` sont publiques
 * par conception, déjà embarquées dans l'app).
 */
const FALLBACK_URL = 'https://yeapyqfmlazdeenhsndk.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllYXB5cWZtbGF6ZGVlbmhzbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjgwNTksImV4cCI6MjA5OTEwNDA1OX0.LXeHTWnYIsY6wyH4b7wX0-3sj_CwrfOepFYg4sXjQtM';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON;

if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL absent — repli sur la constante projet.');
}
console.log('[supabase] URL utilisée =', supabaseUrl);

// Custom storage using SecureStore for token persistence
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
