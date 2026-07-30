import { View, ImageBackground, StyleSheet, ViewStyle } from 'react-native';

/**
 * Fond d'écran commun GBONHI FOOT : couleur sombre `#0D1F0D` + filigrane kente
 * ivoirien répété (motif extrait de la maquette). À utiliser sur tous les écrans
 * pour un rendu homogène et fidèle aux maquettes.
 */
export function ScreenBackground({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flex: 1, backgroundColor: '#0D1F0D' }, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <ImageBackground
          source={require('../../../assets/images/kente-tile.png')}
          resizeMode="repeat"
          style={{ flex: 1 }}
          imageStyle={{ opacity: 0.5 }}
        />
      </View>
      {children}
    </View>
  );
}
