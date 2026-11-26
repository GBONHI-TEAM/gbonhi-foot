import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

/**
 * Connexion Google NATIVE (décision Abraham, 26/11/2026) :
 * le SDK Google natif affiche le sélecteur de compte système, puis on échange
 * le jeton d'identité contre une session Supabase via `signInWithIdToken`
 * (même schéma que `signInWithApple` dans auth-apple.ts).
 *
 * Objectif : faire disparaître le pop-up iOS « "GbonhiFoot" Wants to Use
 * "yeapyq…supabase.co" » et la barre d'adresse *.supabase.co du navigateur
 * intégré — retour testeur A1 du 23/11/2026. Le Branding Google Cloud
 * (nom + logo) reste utile pour l'écran de consentement web, mais seul le
 * natif supprime toute URL Supabase visible.
 *
 * Configuration requise (aucun secret dans le code, ce sont des IDs publics) :
 * - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` : ID client OAuth « Web » existant
 *   (celui déjà utilisé par le provider Google de Supabase).
 * - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` : ID client OAuth « iOS » créé dans
 *   Google Cloud pour le bundle `com.genius21.gbonhifoot`.
 * - app.json → plugin `@react-native-google-signin/google-signin` :
 *   `iosUrlScheme` = ID client iOS inversé (`com.googleusercontent.apps.…`).
 * - Supabase → Authentication → Providers → Google : ajouter l'ID client
 *   iOS aux Client IDs autorisés, à côté de l'ID Web existant.
 *
 * Repli : si le module natif est absent (Expo Go, build sans le plugin) ou
 * si les IDs ne sont pas configurés, on retombe sur l'ancien flux web
 * (ASWebAuthenticationSession + PKCE) pour ne jamais casser la connexion.
 * `handleOAuthDeepLink` reste exporté pour le handler global (_layout) et
 * les liens `gbonhi://?code=…` déjà en circulation.
 */
export const OAUTH_REDIRECT = 'gbonhi://';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let googleConfigured = false;

function configureGoogleNative(): boolean {
  if (googleConfigured) return true;
  if (!GOOGLE_WEB_CLIENT_ID || !GOOGLE_IOS_CLIENT_ID) return false;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });
    googleConfigured = true;
    return true;
  } catch {
    return false;
  }
}

/** Extrait le jeton d'identité des deux formes de réponse du SDK (v12 / v13+). */
function idTokenFromSignInResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  if (typeof record.idToken === 'string' && record.idToken) return record.idToken;
  const data = record.data;
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.idToken === 'string' && dataRecord.idToken) return dataRecord.idToken;
  }
  return null;
}

function isCancelledResult(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as Record<string, unknown>).type === 'cancelled';
}

/** L'utilisateur a fermé le sélecteur de compte Google : pas d'erreur à afficher. */
export function isGoogleCancel(e: unknown): boolean {
  return (
    !!e &&
    typeof e === 'object' &&
    'code' in e &&
    (e as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED
  );
}

async function signInWithGoogleNative(): Promise<boolean> {
  if (!configureGoogleNative()) return false;

  // Android uniquement (Google Play Services) ; sans effet sur iOS.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const result: unknown = await GoogleSignin.signIn();
  if (isCancelledResult(result)) return true; // annulé par l'utilisateur : rien à faire

  const idToken = idTokenFromSignInResult(result);
  if (!idToken) throw new Error("Jeton d'identité Google manquant.");

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return true;
}

export async function signInWithGoogle(): Promise<void> {
  // 1) Flux natif (aucune URL Supabase visible).
  try {
    if (await signInWithGoogleNative()) return;
  } catch (e) {
    if (isGoogleCancel(e)) return;
    // Module natif absent / non configuré → repli web ci-dessous.
    // Toute autre erreur (réseau, Supabase…) est remontée telle quelle.
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: unknown }).code) : '';
    const message = e instanceof Error ? e.message : '';
    const nativeUnavailable =
      code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE ||
      /native module|not linked|RNGoogleSignin/i.test(message);
    if (!nativeUnavailable) throw e;
  }

  // 2) Repli web historique (ASWebAuthenticationSession + PKCE).
  await signInWithGoogleWeb();
}

async function signInWithGoogleWeb(): Promise<void> {
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

  // Google / Supabase ont refusé (ex. `access_denied`, redirect non autorisée) :
  // on remonte la vraie raison au lieu du message générique.
  const oauthError = oauthErrorFromUrl(result.url);
  if (oauthError) throw new Error(oauthError);

  // Échange le code renvoyé dans l'URL contre une session Supabase.
  const exchanged = await handleOAuthDeepLink(result.url);
  if (!exchanged) throw new Error('La connexion Google n’a pas pu être finalisée. Réessaie.');
}

/** Raison du refus OAuth renvoyée dans l'URL de retour (`error_description`, sinon `error`). */
function oauthErrorFromUrl(url: string): string | null {
  const parsed = Linking.parse(url);
  const error = parsed.queryParams?.error;
  if (typeof error !== 'string' || !error) return null;
  const description = parsed.queryParams?.error_description;
  return typeof description === 'string' && description ? description : error;
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
