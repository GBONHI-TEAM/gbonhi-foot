import {
  ImageBackground,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useUserModeStore } from '../../store/user-mode.store';
import { useAuthStore } from '../../store/auth.store';
import { apiClient } from '../../lib/api';

/**
 * Écran 6 — Sélection de mode. Référence : selection_mode06.png.
 * Approche ROBUSTE et déterministe : cartes à HAUTEUR FIXE en pixels,
 * contenu en flux flex normal (space-between) -> icône en haut, bloc
 * titre + description + flèche en bas. Aucun calcul d'échelle, aucun
 * positionnement absolu du contenu : une carte ne peut pas s'effondrer.
 */

const CARD_HEIGHT = 240;

const colors = {
  primaryMedium: '#2E9E4F',
  primaryDeep: '#0D1F0D',
  accent: '#F7921E',
  white: '#FFFFFF',
} as const;

type ModeCardIcon = 'pitch' | 'trophy';

function PitchIcon() {
  return (
    <Svg width={27} height={27} viewBox="0 0 28 28" fill="none">
      <Rect x={3.5} y={3.5} width={21} height={21} rx={2} stroke={colors.white} strokeWidth={2} />
      <Line x1={14} y1={4} x2={14} y2={24} stroke={colors.white} strokeWidth={2} />
      <Circle cx={14} cy={14} r={3.2} stroke={colors.white} strokeWidth={2} />
      <Rect x={3.5} y={9.5} width={4.5} height={9} stroke={colors.white} strokeWidth={2} />
      <Rect x={20} y={9.5} width={4.5} height={9} stroke={colors.white} strokeWidth={2} />
    </Svg>
  );
}

/** Dégradé sombre (fort à gauche, léger à droite) pour la lisibilité du texte. */
function CardShade({ id, tint }: { id: string; tint: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tint} stopOpacity="0.92" />
            <Stop offset="0.5" stopColor={tint} stopOpacity="0.55" />
            <Stop offset="1" stopColor={tint} stopOpacity="0.05" />
          </LinearGradient>
          <LinearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.45" stopColor={tint} stopOpacity="0" />
            <Stop offset="1" stopColor={tint} stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-h)`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-v)`} />
      </Svg>
    </View>
  );
}

interface ModeCardProps {
  photo: ImageSourcePropType;
  gradientId: string;
  tint: string;
  accent: string;
  icon: ModeCardIcon;
  title: string;
  highlight: string;
  description: string;
  onPress: () => void;
}

function ModeCard({ photo, gradientId, tint, accent, icon, title, highlight, description, onPress }: ModeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${highlight}`}
      onPress={onPress}
      style={({ pressed }) => ({
        height: CARD_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: pressed ? accent : 'rgba(255,255,255,0.14)',
        backgroundColor: tint,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <ImageBackground source={photo} resizeMode="cover" style={{ flex: 1 }}>
        <CardShade id={gradientId} tint={tint} />

        <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
          {/* Icône — haut gauche */}
          <View style={[styles.iconCircle, { backgroundColor: accent }]}>
            {icon === 'pitch' ? <PitchIcon /> : <Ionicons name="trophy-outline" size={28} color={colors.white} />}
          </View>

          {/* Titre + description + flèche — bas gauche */}
          <View>
            <Text style={styles.cardTitle}>
              {title}
              {'\n'}
              <Text style={{ color: accent }}>{highlight}</Text>
            </Text>
            <Text style={styles.cardDescription}>{description}</Text>
            <View style={[styles.arrowCircle, { backgroundColor: accent }]}>
              <Ionicons name="arrow-forward" size={24} color={colors.white} />
            </View>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

export default function ModeSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setMode } = useUserModeStore();
  const { user } = useAuthStore();

  const ficheCompletee = user?.user_metadata?.player_profile_completed === true;

  function choose(mode: 'leagues' | 'reservation') {
    if (mode === 'reservation') {
      void apiClient.post('/api/v1/analytics/events', { type: 'MODE_SELECTED', mode }).catch(() => undefined);
      setMode('reservation');
      router.replace('/(tabs)');
      return;
    }
    if (!ficheCompletee) {
      router.push('/(auth)/player-profile');
      return;
    }
    void apiClient.post('/api/v1/analytics/events', { type: 'MODE_SELECTED', mode }).catch(() => undefined);
    setMode('leagues');
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Fond stade immersif (tête d'écran) */}
      <Image
        source={require('../../../assets/images/mode-stadium-bg.png')}
        resizeMode="cover"
        style={styles.headerPhoto}
      />
      <View pointerEvents="none" style={styles.headerShade} />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 14,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* En-tête */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/logo.png')}
            resizeMode="contain"
            style={{ width: 84, height: 68 }}
          />
          <Text style={styles.heading}>
            Que souhaites-tu{'\n'}faire <Text style={{ color: colors.accent }}>aujourd'hui ?</Text>
          </Text>
          <Text style={styles.introduction}>
            Choisis ton mode et commence l'aventure{'\n'}avec Gbonhi Foot
          </Text>
        </View>

        {/* Cartes */}
        <View style={{ gap: 18 }}>
          <ModeCard
            photo={require('../../../assets/images/mode-terrain-card-v2.png')}
            gradientId="terrain-card"
            tint={colors.primaryDeep}
            accent={colors.primaryMedium}
            icon="pitch"
            title="Réserver"
            highlight="un terrain"
            description="Trouve et réserve le meilleur terrain près de chez toi en 2 clics."
            onPress={() => choose('reservation')}
          />
          <ModeCard
            photo={require('../../../assets/images/mode-league-card-v2.png')}
            gradientId="league-card"
            tint="#241407"
            accent={colors.accent}
            icon="trophy"
            title="Participer"
            highlight="aux ligues"
            description="Rejoins une équipe, participe aux compétitions et gagne de l'argent !"
            onPress={() => choose('leagues')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primaryDeep,
  },
  headerPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  headerShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(13,31,13,0.46)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heading: {
    color: colors.white,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  introduction: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    textAlign: 'center',
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.white,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '900',
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 8,
    maxWidth: '60%',
  },
  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
});
