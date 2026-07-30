import { Pressable, Text, Platform } from 'react-native';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bouton retour flottant GLOBAL et « intelligent ».
 * Il s'affiche uniquement quand un retour a du sens :
 *  - la pile de navigation contient un écran précédent (`router.canGoBack()`),
 *  - on n'est PAS sur un écran racine (login, accueil onglets) ni sur un écran
 *    d'onboarding post-auth (sélection de mode, fiche joueur) où « revenir »
 *    renverrait vers l'authentification.
 * Placé en haut-gauche, sous la zone de l'encoche, au-dessus du contenu.
 */

// Écrans où l'on ne veut jamais de bouton retour même si canGoBack() est vrai.
const BLOCKED = new Set([
  'login',
  'splash',
  'mode-selection',
  'player-profile',
]);

export function BackButton() {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const insets = useSafeAreaInsets();

  // Attendre que le navigateur racine soit monté.
  if (!navState?.key) return null;
  if (!router.canGoBack()) return null;

  // Dernier segment de route (ex. 'register', 'otp', 'mode-selection').
  const last = segments[segments.length - 1];
  const isTabsRoot = segments[0] === '(tabs)' && segments.length <= 1;
  if (isTabsRoot || (last && BLOCKED.has(last))) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retour"
      hitSlop={10}
      onPress={() => router.back()}
      style={{
        position: 'absolute',
        top: (insets.top || 44) + 6,
        left: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.38)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        zIndex: 1000,
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 24,
          lineHeight: Platform.OS === 'ios' ? 26 : 28,
          marginTop: -2,
        }}
      >
        ‹
      </Text>
    </Pressable>
  );
}
