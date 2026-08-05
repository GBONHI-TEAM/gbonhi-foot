import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image, View } from 'react-native';

/**
 * Surface commune des headers verts : vert officiel + motif triangulaire de
 * la maquette. Le motif reste volontairement limité au header, jamais au
 * corps des écrans internes.
 */
export function PatternedGreenHeader({
  children,
  style,
  patternOpacity = 0.46,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  patternOpacity?: number;
}) {
  return (
    <View style={[{ backgroundColor: '#1E7A3A', overflow: 'hidden' }, style]}>
      <Image
        source={require('../../../assets/images/kente-green.png')}
        resizeMode="repeat"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: patternOpacity }}
      />
      {children}
    </View>
  );
}
