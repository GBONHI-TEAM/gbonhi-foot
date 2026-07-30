import { View } from 'react-native';

/**
 * MotifsBackground — motifs géométriques ivoiriens officiels.
 *
 * Filigrane Variante B (Login / Auth) : motifs plein écran depuis les 4 coins
 * avec une opacité résiduelle (10-15%) au centre.
 */
export function MotifsBackground({ opacity = 1 }: { opacity?: number }) {
  const corners = [
    { top: -24, left: -24 },
    { top: -24, right: -24 },
    { bottom: -24, left: -24 },
    { bottom: -24, right: -24 },
  ] as const;

  const triangleSize = 46;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
    >
      {corners.map((pos, i) =>
        // motifs depuis chaque coin, dégradé vers le centre (~12% au centre)
        [0, 1, 2, 3, 4, 5].map((j) => {
          const color = j % 3 === 0 ? '#F7921E' : j % 3 === 1 ? '#2E9E4F' : '#FFB830';
          const size = triangleSize * (j + 1);
          const offset = j * 30;
          const cornerPos: Record<string, number> = {};
          if ('top' in pos) cornerPos.top = pos.top + offset;
          if ('bottom' in pos) cornerPos.bottom = pos.bottom + offset;
          if ('left' in pos) cornerPos.left = pos.left + offset;
          if ('right' in pos) cornerPos.right = pos.right + offset;

          return (
            <View
              key={`motif-${i}-${j}`}
              style={[
                {
                  position: 'absolute',
                  width: size,
                  height: size,
                  borderColor: color,
                  borderWidth: 1.5,
                  // opacité pleine aux coins -> ~0.12 au centre
                  opacity: 0.22 - j * 0.018,
                  transform: [{ rotate: '45deg' }],
                },
                cornerPos,
              ]}
            />
          );
        }),
      )}
    </View>
  );
}
