import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

/**
 * Sign in with Apple natif (feuille Apple iOS) → jeton d'identité →
 * supabase.auth.signInWithIdToken. Pas de navigateur, meilleure UX iOS.
 * Disponible uniquement sur iOS 13+.
 */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Jeton d'identité Apple manquant.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  // Apple ne renvoie le nom qu'à la 1re connexion → on le persiste si présent.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (name) {
    try {
      await supabase.auth.updateUser({ data: { full_name: name } });
    } catch {
      /* non bloquant */
    }
  }
}

export function isAppleCancel(e: unknown): boolean {
  return !!e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}
