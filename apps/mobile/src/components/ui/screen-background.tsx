import { View, ViewStyle } from 'react-native';

/**
 * Corps commun des écrans internes GBONHI FOOT.
 *
 * La maquette place les motifs géométriques ivoiriens dans le header uniquement
 * (variante C). Le corps reste volontairement uni afin de préserver la lisibilité
 * des cartes, listes et formulaires.
 */
export function ScreenBackground({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flex: 1, backgroundColor: '#0D1F0D' }, style]}>{children}</View>
  );
}
