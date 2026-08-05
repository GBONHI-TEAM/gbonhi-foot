import { useEffect, useState } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { imageThumb } from '../../lib/image';
import { RemoteImage } from './remote-image';

/**
 * Affiche une image utilisateur à son VRAI ratio → 100% de l'image est visible,
 * jamais recadrée ni déformée, quelle que soit la taille du fichier uploadé.
 *
 * Principe : on lit les dimensions réelles via Image.getSize, puis le conteneur
 * prend exactement l'aspectRatio de l'image (largeur pleine, hauteur calculée).
 * Comme conteneur et image ont le même ratio, `cover` n'a rien à couper.
 *
 * Garde-fou : une image extrêmement haute (portrait) est bornée par `maxRatio`
 * (hauteur/largeur). Au-delà, on passe en `contain` (toujours 100% visible, avec
 * un léger fond sur les côtés) pour éviter qu'un screenshot vertical n'occupe
 * tout l'écran.
 */
export function AutoImage({
  uri,
  radius = 12,
  thumbWidth = 900,
  maxRatio = 1.35,
  background = 'rgba(255,255,255,0.06)',
  marginTop = 0,
}: {
  uri?: string | null;
  radius?: number;
  thumbWidth?: number;
  maxRatio?: number;
  background?: string;
  marginTop?: number;
}) {
  const src = imageThumb(uri, thumbWidth);
  // ratio = largeur / hauteur de l'image d'origine.
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!src) return;
    let mounted = true;
    Image.getSize(
      src,
      (w, h) => { if (mounted && w > 0 && h > 0) setRatio(w / h); },
      () => { if (mounted) setRatio(16 / 9); }, // repli si dimensions indisponibles
    );
    return () => { mounted = false; };
  }, [src]);

  if (!src) return null;

  const minAspect = 1 / maxRatio;                 // borne pour les portraits très hauts
  const tooTall = ratio != null && ratio < minAspect;
  const containerAspect = ratio == null ? 16 / 9 : Math.max(ratio, minAspect);

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: containerAspect,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: background,
        marginTop,
      }}
    >
      <RemoteImage
        uri={src}
        style={{ width: '100%', height: '100%' }}
        // Ratio conteneur == ratio image → `cover` n'ampute rien.
        // Portrait hors-borne → `contain` : image entière, fond sur les côtés.
        contentFit={tooTall ? 'contain' : 'cover'}
      />
      {ratio == null && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color="#F7921E" />
        </View>
      )}
    </View>
  );
}
