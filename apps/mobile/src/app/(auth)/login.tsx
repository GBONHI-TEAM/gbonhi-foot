import { View, ImageBackground, Pressable, StatusBar, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Écran 2 — Login / Accueil (reproduction fidèle de `s02_login.png`).
 * La maquette officielle est utilisée telle quelle en fond ; seules des zones
 * tactiles invisibles sont posées sur les boutons « S'inscrire » et « Se connecter ».
 * Aucune recréation d'élément, aucun mélange avec un autre écran.
 */
export default function LoginScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#0D1F0D' }}>
      <StatusBar hidden />
      <ImageBackground
        source={require('../../../assets/images/login-bg.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      >
        {/* Zone tactile — bouton « S'inscrire » (orange plein) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="S'inscrire"
          onPress={() => router.push('/(auth)/register')}
          style={{ position: 'absolute', left: '6%', right: '6%', top: '76.5%', height: '6.6%' }}
        />

        {/* Zone tactile — bouton « Se connecter » (orange bordé) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Se connecter"
          onPress={() => router.push('/(auth)/sign-in')}
          style={{ position: 'absolute', left: '6%', right: '6%', top: '84.5%', height: '6.6%' }}
        />
      </ImageBackground>
    </View>
  );
}
