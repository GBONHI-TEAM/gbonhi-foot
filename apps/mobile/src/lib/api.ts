import axios from 'axios';
import Constants from 'expo-constants';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type CachedSession = {
  token?: string;
  expiresAt?: number;
};

let sessionCache: CachedSession | null = null;
let sessionLoading: Promise<CachedSession> | null = null;
const SESSION_READ_TIMEOUT_MS = 4_000;

async function readSessionOnce(): Promise<CachedSession> {
  if (sessionCache) return sessionCache;
  if (!sessionLoading) {
    const sessionRead = supabase.auth.getSession().then(({ data }) => ({
      token: data.session?.access_token,
      expiresAt: data.session?.expires_at,
    }));
    // Si SecureStore répond après le garde-fou, on remet tout de même le
    // jeton réel dans le cache pour les requêtes suivantes.
    void sessionRead.then((cached) => { sessionCache = cached; }).catch(() => undefined);
    const timeout = new Promise<CachedSession>((resolve) => {
      setTimeout(() => resolve({}), SESSION_READ_TIMEOUT_MS);
    });
    sessionLoading = Promise.race([sessionRead, timeout])
      .catch(() => ({}))
      .then((cached) => {
        sessionCache = cached;
        return cached;
      })
      .finally(() => {
        sessionLoading = null;
      });
  }
  return sessionLoading;
}

// L'AuthGate pousse ici l'état d'authentification déjà lu. On ne s'abonne pas
// directement dans ce module : Supabase peut émettre un état INITIAL_SESSION
// vide avant que SecureStore ait fini sa lecture, ce qui masquerait le jeton
// réel aux premières requêtes API.
export function setApiAuthSession(session: Session | null): void {
  // `null` invalide le cache au lieu de mémoriser une session vide. Ainsi,
  // lorsqu'INITIAL_SESSION arrive avant SecureStore, la première requête relit
  // bien la session réelle au lieu de partir sans Authorization.
  sessionCache = session
    ? { token: session.access_token, expiresAt: session.expires_at }
    : null;
}

/**
 * Détermine l'URL du backend automatiquement, quel que soit l'appareil :
 * - Simulateur iOS/Android → l'hôte Metro est 127.0.0.1 → backend sur la même machine.
 * - iPhone/Android physique → l'hôte Metro est l'IP LAN du Mac (ex. 192.168.1.7) →
 *   on réutilise CETTE MÊME IP pour joindre le backend (le téléphone atteint le Mac).
 * Plus besoin d'éditer une IP en dur quand on change de device.
 * `EXPO_PUBLIC_API_URL` reste prioritaire si on veut forcer une URL précise.
 *
 * IMPORTANT — builds standalone (TestFlight / APK / production) : il n'y a PAS
 * de serveur Metro, donc `hostUri` est vide. Dans ce cas on NE PEUT PAS taper sur
 * une IP locale (ce serait le téléphone du testeur lui-même). On pointe alors
 * vers le backend déployé sur Render en HTTPS.
 */
const BACKEND_PORT = 3001;
const PROD_API_URL = 'https://gbonhi-foot-api.onrender.com';

/**
 * Base des liens d'invitation d'équipe. TOUJOURS en HTTPS prod (le lien est
 * partagé à d'autres personnes via WhatsApp/SMS) : la page `/join?code=…` est
 * cliquable et ouvre l'app sur /team/join. On n'utilise jamais l'IP locale ici.
 */
export const PUBLIC_LINK_BASE = PROD_API_URL;
export const INVITE_LINK_BASE = PUBLIC_LINK_BASE;

export function teamInviteLink(code: string): string {
  return `${PUBLIC_LINK_BASE}/join?code=${encodeURIComponent(code)}`;
}

export function matchShareLink(matchId: string): string {
  return `${PUBLIC_LINK_BASE}/r/match/${encodeURIComponent(matchId)}`;
}

export function postShareLink(postId: string): string {
  return `${PUBLIC_LINK_BASE}/r/post/${encodeURIComponent(postId)}`;
}

function deriveApiBase(): string {
  // 1) Override explicite (variable d'env de build ou locale) — priorité absolue.
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // 2) Build standalone (TestFlight / APK / prod) : pas de Metro → backend Render.
  if (!__DEV__) return PROD_API_URL;

  // 3) Dev : dériver l'IP LAN du Mac depuis l'hôte Metro.
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
  // 30 s : le backend Render (plan gratuit) s'endort après inactivité ; le premier
  // appel (cold start) peut prendre 30-50 s. À 10 s l'app abandonnait avant la réponse.
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Auto-inject Supabase JWT on every request.
// On rafraîchit le token de façon proactive s'il expire dans moins de 60 s
// (évite les 401 « Token invalide » quand le token a expiré et que le refresh
// automatique n'a pas encore eu lieu, ex. app en arrière-plan).
apiClient.interceptors.request.use(async (config) => {
  const cached = await readSessionOnce();
  let token = cached.token;
  const expiresAt = cached.expiresAt; // secondes epoch

  if (token && expiresAt && expiresAt * 1000 < Date.now() + 60_000) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      token = refreshed.session?.access_token ?? token;
      sessionCache = {
        token,
        expiresAt: refreshed.session?.expires_at ?? expiresAt,
      };
    } catch {
      /* on garde l'ancien token en dernier recours */
    }
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
