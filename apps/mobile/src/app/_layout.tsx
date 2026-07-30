import '../../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth.store';
import { useUserModeStore } from '../store/user-mode.store';
import { BackButton } from '../components/ui/back-button';
import { supabase } from '../lib/supabase';
import '../lib/supabase';
import { registerForPushNotifications } from '../lib/push';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

function AuthGate() {
  const { session, isLoading, setSession, setLoading } = useAuthStore();
  const { mode, hydrated, loadMode } = useUserModeStore();
  const segments = useSegments();
  const router = useRouter();
  // Clé présente uniquement quand le navigateur racine est monté.
  const navState = useRootNavigationState();

  useEffect(() => {
    loadMode();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) registerForPushNotifications();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Après une connexion RÉELLE (pas un simple relancement d'app), on repasse
      // par la Sélection de mode → on efface le mode persistant.
      if (event === 'SIGNED_IN') {
        useUserModeStore.getState().clearMode();
      }
      // Enregistrer le token push dès qu'une session est active (best-effort).
      if (newSession) registerForPushNotifications();
    });

    return () => listener.subscription.unsubscribe();
  }, [setSession, setLoading, loadMode]);

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

    // Connecté + mode choisi (+ fiche si ligue) → application.
    if (inAuth) router.replace('/(tabs)');
  }, [navState?.key, isLoading, hydrated, session, mode, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate />
          <Stack screenOptions={{ headerShown: false }} />
          {/* Bouton retour flottant, affiché intelligemment (voir BackButton) */}
          <BackButton />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
