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
  // Clé présente uniquement quand le navigateur racine est monté.
  const navState = useRootNavigationState();

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
      if (route) setPendingDeepRoute(route);
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

    if (!session) {
      // Non connecté → écrans d'auth.
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // Connecté mais mode non choisi → étape Sélection de mode (ne pas sauter).
    if (!mode) {
      if (!onOnboarding) router.replace('/(auth)/mode-selection');
      return;
    }

    // Mode Ligue : la fiche joueur est obligatoire (Section 3). Tant qu'elle
    // n'est pas complétée, on force l'écran fiche joueur.
    const ficheOk = session.user?.user_metadata?.player_profile_completed === true;
    if (mode === 'leagues' && !ficheOk) {
      if (segments[1] !== 'player-profile') router.replace('/(auth)/player-profile');
      return;
    }

    if (pendingDeepRoute) {
      router.replace(pendingDeepRoute as Href);
      setPendingDeepRoute(null);
      return;
    }

    // Connecté + mode choisi (+ fiche si ligue) → application.
    // On NE renvoie PAS vers les tabs quand l'utilisateur est volontairement sur
    // un écran réutilisable (fiche joueur en édition, changement de mode) : sinon
    // « Modifier le profil » / « Modifier ma fiche joueur » rebondiraient vers l'accueil.
    if (inAuth && !onOnboarding) router.replace('/(tabs)');
  }, [navState?.key, isLoading, hydrated, session, mode, segments, router, pendingDeepRoute]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
