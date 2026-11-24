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
import { KB_DONE_ID } from '../../components/ui/keyboard-done-bar';
import { setPendingOtp } from '../../lib/pending-flow';
import { frenchAuthError } from '../../lib/auth-errors';
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
 * Écran 3 — Inscription.
 * Le fond est la maquette officielle `s03_inscription.png`, utilisée telle quelle
 * (filigrane, halo, logo, titres, boutons — pixel-perfect, aucune recréation).
 *
 * Chaque champ du formulaire est recouvert par un vrai <TextInput> OPAQUE qui
 * reproduit exactement le champ dessiné (fond #263422, bordure, rayon, hauteur)
 * et porte un `placeholder` NATIF. Comportement standard : placeholder visible à
 * vide, curseur au focus, placeholder qui disparaît dès la saisie et réapparaît
 * quand le champ est vidé. Aucun libellé superposé, aucune valeur statique.
 *
 * Géométrie mesurée sur la maquette (754×1628), en fractions :
 *   champs L 7.7 % / R 7.8 %   hauteur 5.8 %
 *   Prénom top 30.1 %  Nom 37.8 %  Téléphone 45.6 %  E-mail 53.3 %
 */

const FIELD_BG = '#263422';
const FIELD = {
  position: 'absolute' as const,
  left: '7.7%' as const,
  right: '7.8%' as const,
  height: '6.0%' as const,
  backgroundColor: FIELD_BG,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.14)',
  color: '#FFFFFF',
  fontSize: 15,
  paddingHorizontal: 22,
};
const PH_COLOR = '#8E948C';

export default function RegisterScreen() {
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!prenom || !nom || !telephone) {
      Alert.alert('Champs requis', 'Renseigne prénom, nom et téléphone.');
      return;
    }
    // L'e-mail sert d'identifiant au compte : il reste requis. Le code de
    // vérification, lui, part par SMS (voir ci-dessous), comme pour la
    // connexion par téléphone et la vérification du numéro après Apple/Google.
    if (!email.trim()) {
      Alert.alert(
        'Adresse e-mail requise',
        'Ton e-mail sert d’identifiant à ton compte. Le code de vérification sera envoyé par SMS sur ton numéro.',
      );
      return;
    }
    setLoading(true);
    const phone = `+225${telephone.replace(/\s/g, '')}`;

    // 1.1 — Empêcher tout doublon : vérifier email ET téléphone avant création.
    try {
      const { data } = await apiClient.post<{ emailExists: boolean; phoneExists: boolean }>(
        '/api/v1/auth/check-account',
        { email, phone },
      );
      if (data.emailExists || data.phoneExists) {
        setLoading(false);
        Alert.alert('Compte existant', 'Ce compte existe déjà. Veuillez vous connecter.');
        return;
      }
    } catch {
      // Si la vérification échoue (backend injoignable), on n'empêche pas
      // l'inscription : l'unicité de l'e-mail reste garantie par Supabase.
    }

    // Vérification par SMS (Orange, via notre API — même canal que la connexion
    // par téléphone et la vérification du numéro après Apple/Google, qui
    // fonctionnaient déjà). Si le SMS n'est pas disponible (service non
    // configuré), on replie sur le code par e-mail au lieu de bloquer
    // l'inscription.
    const fullName = `${prenom} ${nom}`;
    try {
      await apiClient.post('/api/v1/auth/phone/request-otp', { phone, email, purpose: 'register' });
      setLoading(false);
      Alert.alert('Code envoyé par SMS', `Saisis le code à 6 chiffres envoyé au ${phone} par SMS.`);
      await setPendingOtp({ email, phone, channel: 'sms', purpose: 'register' });
      router.push({ pathname: '/(auth)/otp', params: { email, phone, channel: 'sms', purpose: 'register', fullName } });
      return;
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status !== 503) {
        setLoading(false);
        const raw = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
        Alert.alert('Envoi du code impossible', Array.isArray(raw) ? raw.join('\n') : raw ?? 'Réessaie dans un instant.');
        return;
      }
      // SMS indisponible : repli sur le code par e-mail (comportement historique).
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { full_name: fullName, phone },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Envoi du code impossible', frenchAuthError(error.message));
      return;
    }
    Alert.alert(
      'Code envoyé par e-mail',
      'Le SMS est momentanément indisponible : utilise le code envoyé à ton adresse e-mail.',
    );
    await setPendingOtp({ email, phone, channel: 'email' });
    router.push({ pathname: '/(auth)/otp', params: { email, phone } });
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
            source={require('../../../assets/images/register-bg.png')}
            resizeMode="cover"
            style={{ width: '100%', aspectRatio: 754 / 1628 }}
          >
            {/* Prénom (top 30.1 %) — placeholder natif */}
            <TextInput
              style={[FIELD, { top: '30.0%' }]}
              placeholder="Prénom *"
              placeholderTextColor={PH_COLOR}
              value={prenom}
              onChangeText={setPrenom}
              autoCapitalize="words"
              selectionColor="#F7921E"
            />
            {/* Nom (top 37.8 %) */}
            <TextInput
              style={[FIELD, { top: '37.7%' }]}
              placeholder="Nom *"
              placeholderTextColor={PH_COLOR}
              value={nom}
              onChangeText={setNom}
              autoCapitalize="words"
              selectionColor="#F7921E"
            />

            {/* Téléphone (top 45.6 %) — champ opaque reproduisant « 🇨🇮 +225 ▼ | »
                puis un TextInput natif pour le numéro (placeholder natif). */}
            <View
              style={[
                FIELD,
                {
                  top: '45.5%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>🇨🇮</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>+225</Text>
              <Text style={{ color: PH_COLOR, fontSize: 11, marginLeft: 4 }}>▼</Text>
              <View style={{ width: 1, height: '52%', backgroundColor: 'rgba(255,255,255,0.16)', marginHorizontal: 12 }} />
              <TextInput
                style={{ flex: 1, color: '#FFFFFF', fontSize: 15, height: '100%' }}
                placeholder="Numéro de téléphone *"
                placeholderTextColor={PH_COLOR}
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
                selectionColor="#F7921E"
                inputAccessoryViewID={KB_DONE_ID}
              />
            </View>

            {/* E-mail (top 53.3 %) — requis : il sert d'identifiant au compte. */}
            <TextInput
              style={[FIELD, { top: '53.2%' }]}
              placeholder="Adresse e-mail *"
              placeholderTextColor={PH_COLOR}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              selectionColor="#F7921E"
            />

            {/* Zone tactile — « Créer mon compte » (0.618–0.669) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Créer mon compte"
              disabled={loading}
              onPress={handleRegister}
              style={{ position: 'absolute', left: '7.7%', right: '7.8%', top: '61.8%', height: '5.1%' }}
            />
            {/* Zone tactile — Google (0.745–0.796) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuer avec Google"
              onPress={handleGoogle}
              style={{ position: 'absolute', left: '7.7%', right: '7.8%', top: '74.5%', height: '5.1%' }}
            />
            {/* Zone tactile — Apple (0.812–0.862) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuer avec Apple"
              onPress={handleApple}
              style={{ position: 'absolute', left: '7.7%', right: '7.8%', top: '81.2%', height: '5.1%' }}
            />
            {/* Zone tactile — « Se connecter » (~0.945) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Se connecter"
              onPress={() => router.push('/(auth)/sign-in')}
              style={{ position: 'absolute', left: '30%', right: '10%', top: '93.5%', height: '3.5%' }}
            />
          </ImageBackground>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
