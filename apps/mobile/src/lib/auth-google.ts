import * as Linking from 'expo-linking';
import { supabase } from './supabase';

/**
 * Connexion Google via Supabase OAuth, sans dépendance native supplémentaire.
 * - `signInWithOAuth` (skipBrowserRedirect) renvoie l'URL d'autorisation Google.
 * - On l'ouvre dans le navigateur système ; après connexion, Supabase redirige
 *   vers `gbonhi://?code=...` → l'OS rouvre l'app.
 * - Le handler de deep link (root _layout) échange le `code` contre une session.
 *
 * Redirection = `gbonhi://` (déjà autorisée dans Supabase → Redirect URLs).
 * On distingue ce retour du lien d'invitation d'équipe (`gbonhi://join?code=…`)
 * par l'absence de hostname (voir handleOAuthDeepLink).
 */
export const OAUTH_REDIRECT = 'gbonhi://';

export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("URL d'autorisation Google indisponible");
  await Linking.openURL(data.url);
}

/**
 * À appeler sur chaque deep link reçu. Échange le code OAuth contre une session
 * si l'URL correspond au retour Google (`gbonhi://?code=...`, sans hostname).
 * Retourne true si un échange a eu lieu.
 */
export async function handleOAuthDeepLink(url: string): Promise<boolean> {
  if (!url) return false;
  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code;

  // Retour Google = `gbonhi://?code=...` SANS chemin (hostname vide).
  // Les liens d'invitation d'équipe ont un chemin (`gbonhi://team/join?code=...`,
  // hostname « team ») → ne pas les confondre avec un échange OAuth.
  const isOAuthCallback = !parsed.hostname && typeof code === 'string';
  if (!isOAuthCallback) return false;

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code as string);
    if (error) {
      console.log('[oauth] échec de connexion Google:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.log('[oauth] exception connexion Google:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
