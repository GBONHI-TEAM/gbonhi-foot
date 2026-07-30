import { useEffect, useRef, useState } from 'react';
import { Text, Animated, Easing, ImageBackground, StatusBar, StyleSheet, Dimensions, Pressable } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth.store';

const { width: W, height: H } = Dimensions.get('window');
const CY = H * 0.5; // centre vertical (écusson)

// ── Géométrie du ballon (pentagone central + coutures) ──
const BALL = 46;
const BC = BALL / 2;
const PENT_R = 8;
const PENT_ANGLES = [-90, -18, 54, 126, 198];
const pentPoints = PENT_ANGLES.map((a) => {
  const r = (a * Math.PI) / 180;
  return `${(BC + PENT_R * Math.cos(r)).toFixed(1)},${(BC + PENT_R * Math.sin(r)).toFixed(1)}`;
}).join(' ');
const seams = PENT_ANGLES.map((a) => {
  const r = (a * Math.PI) / 180;
  return { x1: BC + PENT_R * Math.cos(r), y1: BC + PENT_R * Math.sin(r), x2: BC + 19 * Math.cos(r), y2: BC + 19 * Math.sin(r) };
});

/**
 * Splash Screen officiel GBONHI FOOT (fond `splash-bg.png`, identique à s01).
 * Ouverture cinématique + graphismes vectoriels (react-native-svg) : halo radial
 * doré qui respire, but avec filet, rond central de terrain, ballon à pentagones
 * qui roule en rebondissant — puis fondu vers l'image finale. Tape pour passer.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { session, isLoading } = useAuthStore();
  const navigated = useRef(false);
  const [animDone, setAnimDone] = useState(false);

  const veil = useRef(new Animated.Value(1)).current;
  const bgScale = useRef(new Animated.Value(1.12)).current;
  const glow = useRef(new Animated.Value(0.45)).current;
  const circle = useRef(new Animated.Value(0)).current;
  const ball = useRef(new Animated.Value(0)).current;
  const flair = useRef(new Animated.Value(1)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  function go() {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(session ? '/(tabs)' : '/(auth)/login');
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(veil, { toValue: 0, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bgScale, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.45, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();

    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(circle, { toValue: 1, duration: 850, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
        Animated.timing(ball, { toValue: 1, duration: 1650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.timing(flair, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();

    Animated.timing(barWidth, { toValue: 1, duration: 2700, easing: Easing.inOut(Easing.quad), useNativeDriver: false })
      .start(() => setAnimDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (animDone && !isLoading) go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animDone, isLoading]);

  const ballX = ball.interpolate({ inputRange: [0, 1], outputRange: [-80, W + 80] });
  const ballY = ball.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -36, 0, -20, 0] });
  const ballRot = ball.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1080deg'] });
  const circleScale = circle.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const circleOpacity = circle.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const glowScale = glow.interpolate({ inputRange: [0.45, 1], outputRange: [0.9, 1.15] });
  const glowOpacity = glow.interpolate({ inputRange: [0.45, 1], outputRange: [0.5, 1] });

  return (
    <Pressable style={{ flex: 1, backgroundColor: '#0D1F0D' }} onPress={() => { if (!isLoading) go(); }}>
      <StatusBar hidden />

      {/* Fond artwork + léger zoom */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: bgScale }] }]}>
        <ImageBackground source={require('../../../assets/images/splash-bg.png')} resizeMode="cover" style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Halo radial doré qui respire */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: W / 2 - 210, top: CY - 210, width: 420, height: 420, opacity: glowOpacity, transform: [{ scale: glowScale }] }}>
        <Svg width={420} height={420}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFB830" stopOpacity={0.28} />
              <Stop offset="45%" stopColor="#F7921E" stopOpacity={0.12} />
              <Stop offset="100%" stopColor="#F7921E" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={210} cy={210} r={210} fill="url(#halo)" />
        </Svg>
      </Animated.View>

      {/* Éléments foot vectoriels (terrain + but), fondus à la fin */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: flair }]}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          {/* But + filet (haut) */}
          <G opacity={0.5}>
            <Line x1={W * 0.32} y1={H * 0.1} x2={W * 0.32} y2={H * 0.19} stroke="#fff" strokeWidth={2.5} />
            <Line x1={W * 0.68} y1={H * 0.1} x2={W * 0.68} y2={H * 0.19} stroke="#fff" strokeWidth={2.5} />
            <Line x1={W * 0.32} y1={H * 0.1} x2={W * 0.68} y2={H * 0.1} stroke="#fff" strokeWidth={2.5} />
            {/* Filet — mailles verticales */}
            {Array.from({ length: 7 }).map((_, i) => {
              const x = W * 0.32 + ((W * 0.36) / 6) * i;
              return <Line key={`v${i}`} x1={x} y1={H * 0.1} x2={x} y2={H * 0.19} stroke="#fff" strokeWidth={0.7} opacity={0.5} />;
            })}
            {/* Filet — mailles horizontales */}
            {Array.from({ length: 4 }).map((_, i) => {
              const y = H * 0.1 + ((H * 0.09) / 3) * i;
              return <Line key={`h${i}`} x1={W * 0.32} y1={y} x2={W * 0.68} y2={y} stroke="#fff" strokeWidth={0.7} opacity={0.5} />;
            })}
          </G>
        </Svg>

        {/* Rond central + ligne médiane (scale animé) */}
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: circleOpacity, transform: [{ scale: circleScale }] }}>
          <Svg width={W} height={H}>
            <Line x1={0} y1={CY} x2={W} y2={CY} stroke="#fff" strokeWidth={1.5} opacity={0.12} />
            <Circle cx={W / 2} cy={CY} r={140} stroke="#fff" strokeWidth={2} opacity={0.18} fill="none" />
            <Circle cx={W / 2} cy={CY} r={5} fill="#fff" opacity={0.2} />
          </Svg>
        </Animated.View>

        {/* Ballon à pentagones qui roule */}
        <Animated.View style={{ position: 'absolute', top: H * 0.66, left: 0, transform: [{ translateX: ballX }, { translateY: ballY }, { rotate: ballRot }] }}>
          <Svg width={BALL} height={BALL}>
            <Circle cx={BC} cy={BC} r={20} fill="#ffffff" stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
            <Polygon points={pentPoints} fill="#0D1F0D" />
            {seams.map((s, i) => (
              <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#0D1F0D" strokeWidth={1.4} />
            ))}
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Voile de révélation */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#05120A', opacity: veil }]} />

      {/* Barre de chargement */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: '9%', left: '20%', right: '20%', height: 3, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', backgroundColor: '#F7921E', borderRadius: 2, width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </Animated.View>

      <Text style={{ position: 'absolute', bottom: '4.5%', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
        Touche pour continuer
      </Text>
    </Pressable>
  );
}
