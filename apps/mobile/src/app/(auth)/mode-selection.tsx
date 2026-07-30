import { View, ImageBackground, Pressable, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserModeStore } from '../../store/user-mode.store';
import { useAuthStore } from '../../store/auth.store';

/**
 * Écran 6 — Sélection de mode (reproduction fidèle de `s06_selection_mode.png`).
 * Fond = maquette telle quelle + deux zones tactiles sur les cartes.
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
          source={require('../../../assets/images/mode-bg.png')}
          resizeMode="cover"
          style={{ width: '100%', aspectRatio: 754 / 1628 }}
        >
          {/* Carte « Réserver un terrain » */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réserver un terrain"
            onPress={() => choose('reservation')}
            style={{ position: 'absolute', left: '4%', right: '4%', top: '34.5%', height: '31.5%' }}
          />
          {/* Carte « Participer aux ligues » */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Participer aux ligues"
            onPress={() => choose('leagues')}
            style={{ position: 'absolute', left: '4%', right: '4%', top: '68%', height: '24%' }}
          />
        </ImageBackground>
      </ScrollView>
    </View>
  );
}
