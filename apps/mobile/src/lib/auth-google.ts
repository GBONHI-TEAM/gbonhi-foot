import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/**
 * Connexion Google via Supabase OAuth.
 * - `signInWithOAuth` (skipBrowserRedirect) renvoie l'URL d'autorisation Google.
 * - On ouvre cette URL dans une SESSION d'authentification (ASWebAuthenticationSession
 *   sur iOS / Custom Tab sur Android) via `openAuthSessionAsync`. Contrairement à
 *   `Linking.openURL` + Safari, cette session CAPTURE de façon fiable la redirection
 *   vers `gbonhi://?code=...` et nous rend l'URL directement — sans dépendre du fait
 *   que le navigateur système accepte de rouvrir l'app (ce qui échouait sur iOS et
 *   renvoyait l'utilisateur à l'écran d'accueil sans session).
 * - On échange ensuite le `code` contre une session (PKCE).
 *
 * Redirection = `gbonhi://` (déjà autorisée dans Supabase → Redirect URLs).
 * Le handler de deep link global (root _layout) reste un filet de secours.
 */
export const OAUTH_REDIRECT = 'gbonhi://';

export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("URL d'autorisation Google indisponible");

  // Ouvre la session d'auth et attend le retour sur `gbonhi://`.
  const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);

  // L'utilisateur a fermé la fenêtre sans terminer : on n'affiche pas d'erreur.
  if (result.type !== 'success' || !result.url) return;

  // Échange le code renvoyé dans l'URL contre une session Supabase.
  const exchanged = await handleOAuthDeepLink(result.url);
  if (!exchanged) throw new Error('La connexion Google n’a pas pu être finalisée. Réessaie.');
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
