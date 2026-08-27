import * as SecureStore from 'expo-secure-store';

/**
 * Persistance légère des « parcours en cours » pour survivre à un passage en
 * arrière-plan / une fermeture de l'app par le système (fréquent sur Android à
 * faible mémoire). On y stocke :
 *  - le contexte OTP (email/téléphone/canal) pour revenir sur l'écran de code
 *    quand l'utilisateur va chercher son code dans sa boîte mail ;
 *  - la route d'un lien d'invitation/contenu (deep link) à ouvrir après auth.
 */
const OTP_KEY = 'gbonhi_pending_otp';
const DEEP_KEY = 'gbonhi_pending_deep_route';
const OTP_TTL_MS = 15 * 60 * 1000; // les codes expirent : on ignore un contexte trop vieux

export interface PendingOtp {
  email?: string;
  phone?: string;
  channel: 'email' | 'sms';
  purpose?: string;
  ts: number;
}

export async function setPendingOtp(v: Omit<PendingOtp, 'ts'>): Promise<void> {
  try { await SecureStore.setItemAsync(OTP_KEY, JSON.stringify({ ...v, ts: Date.now() })); } catch { /* best-effort */ }
}
export async function getPendingOtp(): Promise<PendingOtp | null> {
  try {
    const raw = await SecureStore.getItemAsync(OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOtp;
    if (!parsed?.ts || Date.now() - parsed.ts > OTP_TTL_MS) { await clearPendingOtp(); return null; }
    return parsed;
  } catch { return null; }
}
export async function clearPendingOtp(): Promise<void> {
  try { await SecureStore.deleteItemAsync(OTP_KEY); } catch { /* best-effort */ }
}

export async function setPendingDeepRoute(route: string): Promise<void> {
  try { await SecureStore.setItemAsync(DEEP_KEY, route); } catch { /* best-effort */ }
}
export async function getPendingDeepRoute(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(DEEP_KEY); } catch { return null; }
}
export async function clearPendingDeepRoute(): Promise<void> {
  try { await SecureStore.deleteItemAsync(DEEP_KEY); } catch { /* best-effort */ }
}
