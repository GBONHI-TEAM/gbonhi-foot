import { View, Text, Image, Pressable } from 'react-native';
import { PatternedGreenHeader } from './patterned-green-header';

/**
 * En-tête réutilisable fidèle aux exports mobiles : fond vert officiel,
 * motifs géométriques ivoiriens limités au header et coins bas arrondis.
 *
 * Deux usages :
 *  - Accueil : `leading` = logo (par défaut), `title` = « Bonjour X 👋 », `subtitle`,
 *    `actions` à droite (changer de mode, cloche…).
 *  - Écrans de détail : passer `onBack` pour afficher une flèche retour à gauche.
 */
export function AppHeader({
  title,
  subtitle,
  actions,
  onBack,
  showLogo = true,
  centered = false,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onBack?: () => void;
  showLogo?: boolean;
  /** À utiliser pour les écrans de détail : titre centré, retour à gauche. */
  centered?: boolean;
}) {
  const titleLeftInset = onBack && showLogo ? 116 : onBack || showLogo ? 72 : 20;
  const titleRightInset = actions ? 76 : 20;

  return (
    <PatternedGreenHeader
      style={{
        paddingTop: 56,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}
      patternOpacity={0.5}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityLabel="Retour"
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: centered ? 0 : 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 22, marginTop: -2 }}>←</Text>
          </Pressable>
        ) : null}

        {showLogo ? (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              marginLeft: onBack ? 8 : 0,
              marginRight: 12,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: '#0D1F0D',
              borderWidth: 2,
              borderColor: '#FFB830',
            }}
          >
            <Image source={require('../../../assets/images/logo.png')} resizeMode="contain" style={{ width: 42, height: 34 }} />
          </View>
        ) : null}

        <View
          style={centered ? { position: 'absolute', left: titleLeftInset, right: titleRightInset, alignItems: 'center' } : { flex: 1, minWidth: 0 }}
        >
          <Text numberOfLines={centered ? 1 : 2} style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: centered ? 'center' : 'left' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={centered ? 1 : 2} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2, textAlign: centered ? 'center' : 'left' }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {actions ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>{actions}</View> : null}
      </View>
    </PatternedGreenHeader>
  );
}

/** Bouton d'action rond translucide pour le header (cloche, changer de mode…). */
export function HeaderAction({
  onPress,
  label,
  children,
  badge = false,
  style,
}: {
  onPress?: () => void;
  label: string;
  children: React.ReactNode;
  badge?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.15)',
          marginLeft: 8,
        },
        style,
      ]}
    >
      {children}
      {badge ? (
        <View style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: '#E53935', borderWidth: 1.5, borderColor: '#1E7A3A' }} />
      ) : null}
    </Pressable>
  );
}
