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
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api';
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

    // Connexion via le canal e-mail (SMS non encore configuré) :
    // 1) retrouver l'email associé au numéro, 2) envoyer le code e-mail.
    try {
      const { data } = await apiClient.post<{ email: string | null }>(
        '/api/v1/auth/resolve-login',
        { phone },
      );
      if (!data.email) {
        setLoading(false);
        Alert.alert('Aucun compte', "Aucun compte associé à ce numéro. Inscris-toi d'abord.");
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: { shouldCreateUser: false },
      });
      setLoading(false);
      if (error) {
        Alert.alert('Connexion impossible', error.message);
        return;
      }
      router.push({ pathname: '/(auth)/otp', params: { email: data.email, phone, channel: 'email' } });
    } catch (e: unknown) {
      setLoading(false);
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      Alert.alert('Connexion impossible', `Impossible de contacter le serveur (${msg}). Vérifie que le backend est démarré.`);
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
