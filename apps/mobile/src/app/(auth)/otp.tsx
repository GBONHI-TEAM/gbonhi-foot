import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

/**
 * Écran 4 — Vérification OTP. Fond = maquette `s04_otp.png` retravaillée
 * (numéro + cases gravés retirés par recopie du filigrane, période 57 px).
 *
 * Deux canaux :
 *  - `email` (depuis l'inscription) : code 6 chiffres → 6 cases dessinées,
 *    fond `otp-bg-email.png`, `verifyOtp(type:'email')`.
 *  - `sms` (depuis la connexion, Twilio Verify 4 chiffres) : 4 cases posées sur
 *    les cases de la maquette, fond `otp-bg.png`, `verifyOtp(type:'sms')`.
 */

const SMS_COLS = ['7.4%', '29.7%', '52.0%', '74.3%'] as const;

function formatPhone(p?: string) {
  if (!p) return '';
  const d = p.replace(/^\+225/, '').replace(/\D/g, '');
  return `+225 ${d.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`.trim();
}

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; phone?: string; channel?: string }>();
  const email = params.email;
  const phone = params.phone;
  const channel: 'email' | 'sms' = params.channel === 'sms' ? 'sms' : 'email';
  const length = channel === 'sms' ? 4 : 6;

  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(channel === 'sms' ? '/(auth)/sign-in' : '/(auth)/register');
  }

  function handleDigit(value: string, index: number) {
    const digitsOnly = value.replace(/[^0-9]/g, '');

    // Auto-remplissage / collage du code complet : on répartit TOUJOURS depuis
    // la première case (sinon iOS peut commencer au milieu).
    if (digitsOnly.length > 1) {
      const next = Array(length).fill('');
      for (let i = 0; i < Math.min(digitsOnly.length, length); i++) next[i] = digitsOnly[i];
      setDigits(next);
      const lastFilled = Math.min(digitsOnly.length, length) - 1;
      inputRefs.current[lastFilled]?.focus();
      return;
    }

    const digit = digitsOnly.slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < length - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < length) {
      Alert.alert('Erreur', `Saisir le code complet à ${length} chiffres`);
      return;
    }
    setLoading(true);
    const { error } =
      channel === 'sms'
        ? await supabase.auth.verifyOtp({ phone: phone ?? '', token: code, type: 'sms' })
        : await supabase.auth.verifyOtp({ email: email ?? '', token: code, type: 'email' });
    setLoading(false);
    if (error) Alert.alert('Code invalide', error.message);
    // Succès → redirection auto (onAuthStateChange dans le root layout).
  }

  async function handleResend() {
    if (countdown > 0 || resending) return;
    if (channel === 'sms' && !phone) { Alert.alert('Erreur', 'Numéro manquant, reviens en arrière.'); return; }
    if (channel === 'email' && !email) { Alert.alert('Erreur', 'Email manquant, reviens en arrière.'); return; }

    setResending(true);
    try {
      const { error } =
        channel === 'sms'
          ? await supabase.auth.signInWithOtp({ phone: phone as string })
          : await supabase.auth.signInWithOtp({ email: email as string, options: { shouldCreateUser: true } });

      if (error) {
        Alert.alert('Renvoi impossible', error.message);
        return;
      }
      setDigits(Array(length).fill(''));
      inputRefs.current[0]?.focus();
      setCountdown(60);
      Alert.alert(
        'Code renvoyé',
        channel === 'sms'
          ? `Un nouveau code a été envoyé au ${formatPhone(phone)}.`
          : `Un nouveau code a été envoyé à ${email}.`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Vérifie ta connexion et réessaie.';
      Alert.alert('Renvoi impossible', msg);
    } finally {
      setResending(false);
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
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <ImageBackground
            source={
              channel === 'sms'
                ? require('../../../assets/images/otp-bg.png')
                : require('../../../assets/images/otp-bg-email.png')
            }
            resizeMode="cover"
            style={{ width: '100%', aspectRatio: 754 / 1628 }}
          >
            {/* Bouton retour visible (haut-gauche) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              onPress={goBack}
              hitSlop={10}
              style={{
                position: 'absolute', top: '6%', left: '6%',
                width: 40, height: 40, borderRadius: 20,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                zIndex: 10,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 22, marginTop: -2 }}>←</Text>
            </Pressable>

            {/* Sous-titre dynamique — vrai destinataire */}
            <View style={{ position: 'absolute', top: '35.9%', left: '5%', right: '5%', alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: channel === 'sms' ? 16 : 15 }}>
                Code envoyé {channel === 'sms' ? 'au ' : 'à '}
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {channel === 'sms' ? formatPhone(phone) : email}
                </Text>
              </Text>
            </View>

            {channel === 'sms' ? (
              /* 4 cases transparentes sur les cases gravées de la maquette */
              digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { if (ref) inputRefs.current[i] = ref; }}
                  value={d}
                  onChangeText={(v) => handleDigit(v, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={i === 0 ? length : 1}
                  textContentType="oneTimeCode"
                  autoComplete={i === 0 ? 'sms-otp' : 'off'}
                  selectionColor="#F7921E"
                  style={{
                    position: 'absolute',
                    left: SMS_COLS[i],
                    top: '42.5%',
                    width: '18.6%',
                    height: '8.3%',
                    textAlign: 'center',
                    color: '#FFFFFF',
                    fontSize: 30,
                    fontWeight: '700',
                  }}
                />
              ))
            ) : (
              /* 6 cases dessinées au style de la maquette */
              <View
                style={{
                  position: 'absolute',
                  left: '6%',
                  right: '6%',
                  top: '42.5%',
                  height: '8.3%',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                {digits.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => { if (ref) inputRefs.current[i] = ref; }}
                    value={d}
                    onChangeText={(v) => handleDigit(v, i)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={i === 0 ? length : 1}
                    textContentType="oneTimeCode"
                    autoComplete={i === 0 ? 'sms-otp' : 'off'}
                    selectionColor="#F7921E"
                    style={{
                      width: '14.5%',
                      height: '100%',
                      textAlign: 'center',
                      color: '#FFFFFF',
                      fontSize: 26,
                      fontWeight: '700',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: d ? '#F7921E' : 'rgba(255,255,255,0.22)',
                      borderRadius: 16,
                    }}
                  />
                ))}
              </View>
            )}

            {/* Bouton dynamique — « Renvoyer le code » (recouvre le texte gravé) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Renvoyer le code"
              onPress={handleResend}
              disabled={countdown > 0 || resending}
              style={{
                position: 'absolute', left: '18%', right: '18%', top: '52.8%', height: '4.4%',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#0D1F0D', borderRadius: 20,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: countdown > 0 ? 'rgba(255,255,255,0.45)' : '#F7921E' }}>
                {resending
                  ? 'Envoi en cours…'
                  : countdown > 0
                    ? `Renvoyer le code (${countdown}s)`
                    : 'Renvoyer le code'}
              </Text>
            </Pressable>
            {/* Zone tactile — « Vérifier » */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vérifier"
              onPress={handleVerify}
              disabled={loading}
              style={{ position: 'absolute', left: '7.7%', right: '7.8%', top: '84.3%', height: '6.3%' }}
            />
            {/* Zone tactile — « Modifier le numéro » */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Modifier"
              onPress={goBack}
              style={{ position: 'absolute', left: '28%', right: '28%', top: '93.0%', height: '3.2%' }}
            />
          </ImageBackground>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
