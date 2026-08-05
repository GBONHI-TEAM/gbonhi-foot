import { View, ImageBackground, Pressable, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserModeStore } from '../../store/user-mode.store';
import { useAuthStore } from '../../store/auth.store';
import { apiClient } from '../../lib/api';

/**
 * Écran 6 — Sélection de mode.
 * Référence validée du 04/08/2026 : terrain nocturne immersif, logo et titre
 * centrés, puis deux cartes de choix superposées et contrastées.
 *
 * Flux (Sections 2 & 3) :
 *  - « Réserver un terrain » → mode réservation → accueil.
 *  - « Participer à une ligue » → si la fiche joueur n'existe pas, on FORCE sa
 *    création avant tout accès ; sinon accès direct à l'accueil.
 */
export default function ModeSelectionScreen() {
  const router = useRouter();
  const { setMode } = useUserModeStore();
  const { user } = useAuthStore();

  const ficheCompletee = user?.user_metadata?.player_profile_completed === true;

  function choose(mode: 'leagues' | 'reservation') {
    if (mode === 'reservation') {
      void apiClient.post('/api/v1/analytics/events', { type: 'MODE_SELECTED', mode }).catch(() => undefined);
      setMode('reservation');
      router.replace('/(tabs)');
      return;
    }
    // Ligue : la fiche joueur est obligatoire.
    if (!ficheCompletee) {
      // On ne fixe PAS encore le mode : la fiche doit être créée d'abord.
      router.push('/(auth)/player-profile');
      return;
    }
    void apiClient.post('/api/v1/analytics/events', { type: 'MODE_SELECTED', mode }).catch(() => undefined);
    setMode('leagues');
    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0D1F0D' }}>
      <StatusBar hidden />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <ImageBackground
          source={require('../../../assets/images/mode-selection-reference.png')}
          resizeMode="cover"
          style={{ width: '100%', aspectRatio: 340 / 838 }}
        >
          {/* Carte « Réserver un terrain » */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réserver un terrain"
            onPress={() => choose('reservation')}
            style={{ position: 'absolute', left: '6%', right: '6%', top: '31.5%', height: '30.5%' }}
          />
          {/* Carte « Participer aux ligues » */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Participer aux ligues"
            onPress={() => choose('leagues')}
            style={{ position: 'absolute', left: '6%', right: '6%', top: '64%', height: '30%' }}
          />
        </ImageBackground>
      </ScrollView>
    </View>
  );
}
