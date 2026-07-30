import axios from 'axios';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Détermine l'URL du backend automatiquement, quel que soit l'appareil :
 * - Simulateur iOS/Android → l'hôte Metro est 127.0.0.1 → backend sur la même machine.
 * - iPhone/Android physique → l'hôte Metro est l'IP LAN du Mac (ex. 192.168.1.7) →
 *   on réutilise CETTE MÊME IP pour joindre le backend (le téléphone atteint le Mac).
 * Plus besoin d'éditer une IP en dur quand on change de device.
 * `EXPO_PUBLIC_API_URL` reste prioritaire si on veut forcer une URL précise.
 */
const BACKEND_PORT = 3001;

function deriveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // hostUri ressemble à "192.168.1.7:8081" (device) ou "127.0.0.1:8081" (simu).
  const anyConst = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
    manifest?: { debuggerHost?: string; hostUri?: string };
  };
  const hostUri =
    anyConst.expoConfig?.hostUri ||
    anyConst.expoGoConfig?.debuggerHost ||
    anyConst.manifest2?.extra?.expoGo?.debuggerHost ||
    anyConst.manifest?.debuggerHost ||
    anyConst.manifest?.hostUri ||
    '';
  const host = hostUri.split(':')[0]?.trim();
  if (host) return `http://${host}:${BACKEND_PORT}`;
  return `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE = deriveApiBase();

// Diagnostic : confirme l'URL réellement utilisée par l'app (visible dans Metro).
console.log('[api] API_BASE =', API_BASE);

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Auto-inject Supabase JWT on every request
apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return config;
});
