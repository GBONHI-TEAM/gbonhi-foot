import '../../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState, type Href } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth.store';
import { useUserModeStore } from '../store/user-mode.store';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { setApiAuthSession } from '../lib/api';
import '../lib/supabase';
import { registerForPushNotifications } from '../lib/push';
import { handleOAuthDeepLink } from '../lib/auth-google';
import { routeFromGbonhiLink } from '../lib/deep-link';
import { KeyboardDoneBar } from '../components/ui/keyboard-done-bar';
import {
  getPendingDeepRoute,
  setPendingDeepRoute as persistDeepRoute,
  clearPendingDeepRoute,
  getPendingOtp,
  type PendingOtp,
} from '../lib/pending-flow';

const INITIAL_SESSION_TIMEOUT_MS = 4_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

function AuthGate() {
  const { session, isLoading, setSession, setLoading } = useAuthStore();
  const { mode, hydrated, startNewAppSession } = useUserModeStore();
  const segments = useSegments();
  const router = useRouter();
  const [pendingDeepRoute, setPendingDeepRoute] = useState<string | null>(null);
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
  // Clé présente uniquement quand le navigateur racine est monté.
  const navState = useRootNavigationState();

  // Reprise après une fermeture par le système : on recharge un éventuel deep
  // link d'invitation et un contexte OTP en cours (persistés dans SecureStore).
  useEffect(() => {
    let mounted = true;
    getPendingDeepRoute().then((r) => { if (mounted && r) setPendingDeepRoute((cur) => cur ?? r); });
    getPendingOtp().then((o) => { if (mounted) setPendingOtp(o); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // Règle produit : un relancement complet repart toujours par le choix de
    // mode, quel que soit le dernier écran ouvert avant la fermeture.
    startNewAppSession();
    let mounted = true;
    // Une lecture SecureStore/Supabase qui se bloque ne doit jamais garder
    // l'utilisateur sur le splash. La session réelle, si elle arrive plus
    // tard, est toujours prise en compte et l'AuthGate se réoriente.
    const sessionTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, INITIAL_SESSION_TIMEOUT_MS);
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setApiAuthSession(data.session);
        setSession(data.session);
        if (data.session) registerForPushNotifications();
      })
      .catch(() => {
        if (mounted) {
          setApiAuthSession(null);
          setSession(null);
        }
      })
      .finally(() => {
        clearTimeout(sessionTimeout);
        if (mounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setApiAuthSession(newSession);
      setSession(newSession);
      // Après une connexion RÉELLE (pas un simple relancement d'app), on repasse
      // par la Sélection de mode → on efface le mode persistant.
      if (event === 'SIGNED_IN') {
        useUserModeStore.getState().clearMode();
      }
      // Enregistrer le token push dès qu'une session est active (best-effort).
      if (newSession) registerForPushNotifications();
    });

    return () => {
      mounted = false;
      clearTimeout(sessionTimeout);
      listener.subscription.unsubscribe();
    };
  }, [setSession, setLoading, startNewAppSession]);

  // Liens entrants : OAuth Google ou contenu partagé (match, post, équipe).
  // Une route est mémorisée jusqu'à ce que l'auth, le mode et la fiche soient
  // prêts : sans compte, l'utilisateur voit d'abord la connexion puis revient
  // automatiquement au contenu demandé.
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (await handleOAuthDeepLink(url)) return;
      const route = routeFromGbonhiLink(url);
      if (route) { setPendingDeepRoute(route); void persistDeepRoute(route); }
    };
    Linking.getInitialURL().then((url) => { if (url) void handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Attendre que le navigateur soit monté, la session résolue ET le mode chargé.
    if (!navState?.key || isLoading || !hydrated) return;

    // Écran d'entrée (splash animé, route index → segments vides) : on laisse le
    // splash gérer lui-même la navigation à la fin de son intro. L'AuthGate reprend
    // dès que le splash a navigué vers /(auth) ou /(tabs).
    if (!segments[0]) return;

    const inAuth = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'mode-selection' || segments[1] === 'player-profile';
    // Écrans atteints via un lien partagé (invitation d'équipe, match, publication)
    // : on n'y impose PAS la sélection de mode, pour ne pas éjecter l'utilisateur
    // de l'écran d'invitation (ex. rejoindre une équipe avec le code pré-rempli).
    const onDeepTarget = segments[0] === 'team' || segments[0] === 'match' || segments[0] === 'community';

    if (!session) {
      // Non connecté. Si une vérification OTP était en cours (l'app a pu être
      // fermée par le système pendant qu'on allait chercher le code en boîte
      // mail), on rouvre l'écran de code au lieu de repartir de la connexion.
      if (pendingOtp && segments[1] !== 'otp') {
        router.replace({
          pathname: '/(auth)/otp',
          params: {
            ...(pendingOtp.email ? { email: pendingOtp.email } : {}),
            ...(pendingOtp.phone ? { phone: pendingOtp.phone } : {}),
            channel: pendingOtp.channel,
            ...(pendingOtp.purpose ? { purpose: pendingOtp.purpose } : {}),
          },
        });
        return;
      }
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // Vérification obligatoire du numéro : les comptes Apple/Google n'ont pas de
    // numéro. Tant que `phone` n'est pas renseigné (et vérifié via OTP), on force
    // l'écran de vérification. Les comptes e-mail ont déjà un numéro → ignorés.
    const hasPhone = !!(session.user?.user_metadata?.phone as string | undefined)?.trim();
    if (!hasPhone) {
      if (segments[1] !== 'verify-phone' && segments[1] !== 'otp') router.replace('/(auth)/verify-phone');
      return;
    }

    // Deep link (invitation d'équipe, match, publication) : PRIORITAIRE sur la
    // sélection de mode. Un utilisateur authentifié + numéro vérifié qui ouvre un
    // lien d'invitation va DIRECTEMENT sur l'écran cible (code pré-rempli), sans
    // passer par la sélection de mode.
    if (pendingDeepRoute) {
      router.replace(pendingDeepRoute as Href);
      setPendingDeepRoute(null);
      void clearPendingDeepRoute();
      return;
    }

    // Connecté mais mode non choisi → étape Sélection de mode (ne pas sauter),
    // sauf si on est sur un écran cible de lien partagé.
    if (!mode) {
      if (!onOnboarding && !onDeepTarget) router.replace('/(auth)/mode-selection');
      return;
    }

    // Mode Ligue : la fiche joueur est obligatoire (Section 3). Tant qu'elle
    // n'est pas complétée, on force l'écran fiche joueur.
    const ficheOk = session.user?.user_metadata?.player_profile_completed === true;
    if (mode === 'leagues' && !ficheOk) {
      if (segments[1] !== 'player-profile') router.replace('/(auth)/player-profile');
      return;
    }

    // Connecté + mode choisi (+ fiche si ligue) → application.
    // On NE renvoie PAS vers les tabs quand l'utilisateur est volontairement sur
    // un écran réutilisable (fiche joueur en édition, changement de mode) : sinon
    // « Modifier le profil » / « Modifier ma fiche joueur » rebondiraient vers l'accueil.
    if (inAuth && !onOnboarding) router.replace('/(tabs)');
  }, [navState?.key, isLoading, hydrated, session, mode, segments, router, pendingDeepRoute, pendingOtp]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate />
          <Stack screenOptions={{ headerShown: false }} />
          {/* Barre « Terminé » globale au-dessus du clavier (iOS) */}
          <KeyboardDoneBar />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
