import { View, Text, Image, ImageBackground, Pressable } from 'react-native';

/**
 * En-tête vert kente réutilisable (fidèle à la maquette s08) : fond vert
 * `#1E7A3A` avec filigrane kente, coins bas arrondis.
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
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onBack?: () => void;
  showLogo?: boolean;
}) {
  return (
    <ImageBackground
      source={require('../../../assets/images/kente-green.png')}
      resizeMode="repeat"
      style={{
        paddingTop: 56,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
      }}
      imageStyle={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityLabel="Retour"
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 22, marginTop: -2 }}>‹</Text>
          </Pressable>
        ) : showLogo ? (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              marginRight: 12,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: '#0D1F0D',
              borderWidth: 2,
              borderColor: '#FFB830',
            }}
          >
            <Image source={require('../../../assets/images/logo.png')} resizeMode="contain" style={{ width: 40, height: 28 }} />
          </View>
        ) : null}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {actions ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>{actions}</View> : null}
      </View>
    </ImageBackground>
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
