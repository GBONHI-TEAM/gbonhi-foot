import { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  Pressable,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../../lib/api';
import { setPendingOtp } from '../../lib/pending-flow';
import { signInWithGoogle } from '../../lib/auth-google';
import { signInWithApple, isAppleCancel } from '../../lib/auth-apple';

async function handleGoogle() {
  try {
    await signInWithGoogle();
  } catch (e) {
    Alert.alert('Connexion Google impossible', e instanceof Error ? e.message : 'Réessaie.');
  }
}

async function handleApple() {
  if (Platform.OS !== 'ios') {
    Alert.alert('iOS uniquement', 'La connexion Apple est disponible sur iPhone.');
    return;
  }
  try {
    await signInWithApple();
  } catch (e) {
    if (isAppleCancel(e)) return;
    Alert.alert('Connexion Apple impossible', e instanceof Error ? e.message : 'Réessaie.');
  }
}

/**
 * Écran 5 — Se connecter (reproduction fidèle de `s05_confirmation_compte.png`).
 * Fond = maquette telle quelle (filigrane, halo, logo, titres, boutons, liens).
 * Le champ téléphone gravé est recouvert par un champ opaque reproduisant
 * « 🇨🇮 +225 | » avec un `TextInput` natif (placeholder « Numéro de téléphone * »).
 *
 * « Continuer » envoie un code SMS au numéro (`type: 'sms'`) → écran OTP (canal
 * sms, 4 cases). Actif dès que Twilio Verify est configuré dans Supabase.
 *
 * Géométrie mesurée (754×1628) : champ top 31.8 % / hauteur 7.1 % (L 7.7 / R 7.8),
 * Continuer 40.9 %, Google 54.8 %, Apple 62.8 %, « S'inscrire » ~93.8 %.
 */

const PH_COLOR = '#8E948C';

export default function SignInScreen() {
  const router = useRouter();
  const [telephone, setTelephone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!telephone) {
      Alert.alert('Numéro requis', 'Saisis ton numéro de téléphone.');
      return;
    }
    setLoading(true);
    const phone = `+225${telephone.replace(/\s/g, '')}`;

    // Connexion par téléphone : envoi du code par SMS (Orange). Le backend
    // vérifie qu'un compte existe pour ce numéro avant d'envoyer le SMS.
    try {
      await apiClient.post('/api/v1/auth/phone/request-otp', { phone, purpose: 'login' });
      setLoading(false);
      await setPendingOtp({ phone, channel: 'sms', purpose: 'login' });
      router.push({ pathname: '/(auth)/otp', params: { phone, channel: 'sms', purpose: 'login' } });
    } catch (e: unknown) {
      setLoading(false);
      const raw = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join('\n') : raw ?? (e instanceof Error ? e.message : 'Réessaie dans un instant.');
      Alert.alert('Connexion impossible', msg);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0D1F0D' }}>
      <StatusBar hidden />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <ImageBackground
            source={require('../../../assets/images/signin-bg.png')}
            resizeMode="cover"
            style={{ width: '100%', aspectRatio: 754 / 1628 }}
          >
            {/* Champ téléphone opaque (recouvre le champ gravé) */}
            <View
              style={{
                position: 'absolute',
                left: '7.7%',
                right: '7.8%',
                top: '31.8%',
                height: '7.1%',
                backgroundColor: '#263422',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 18,
              }}
            >
              <Text style={{ fontSize: 18 }}>🇨🇮</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>+225</Text>
              <View style={{ width: 1, height: '48%', backgroundColor: 'rgba(255,255,255,0.16)', marginHorizontal: 14 }} />
              <TextInput
                style={{ flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%' }}
                placeholder="Numéro de téléphone *"
                placeholderTextColor={PH_COLOR}
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
                selectionColor="#F7921E"
              />
            </View>

            {/* Zone tactile — « Continuer » (0.409–0.472) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuer"
              disabled={loading}
              onPress={handleContinue}
              style={{ position: 'absolute', left: '7.7%', right: '7.8%', top: '40.9%', height: '6.3%' }}
            />
            {/* Zone tactile — Google (0.548–0.611) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuer avec Google"
              onPress={handleGoogle}
              style={{ position: 'absolute', left: '7.7%', right: '7.8%', top: '54.8%', height: '6.3%' }}
            />
            {/* Zone tactile — Apple (0.628–0.689) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuer avec Apple"
              onPress={handleApple}
              style={{ position: 'absolute', left: '7.7%', right: '7.8%', top: '62.8%', height: '6.1%' }}
            />
            {/* Zone tactile — « S'inscrire » (~0.938) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="S'inscrire"
              onPress={() => router.push('/(auth)/register')}
              style={{ position: 'absolute', left: '55%', right: '10%', top: '93.2%', height: '3.2%' }}
            />
          </ImageBackground>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
