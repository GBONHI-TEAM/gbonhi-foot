import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ImageBackground, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { KB_DONE_ID } from '../../components/ui/keyboard-done-bar';
import { setPendingOtp, clearPendingOtp, clearPendingDeepRoute } from '../../lib/pending-flow';

const CIV_PHONE = /^\d{8,10}$/;

/**
 * Vérification du numéro pour les comptes créés via Apple / Google (qui ne
 * fournissent pas de numéro). Étape obligatoire avant d'accéder à l'app.
 * En attendant l'intégration SMS (Orange), le code OTP est envoyé par e-mail.
 */
export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const email = user?.email ?? '';
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation de la session au montage : si le compte a été supprimé côté
  // serveur (JWT encore en cache), getUser renvoie une erreur → on purge et on
  // repart de la connexion, au lieu de rester coincé sur cet écran (le cas se
  // produisait après une suppression de compte, même app fermée puis rouverte).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { error } = await supabase.auth.getUser();
      // On NE déconnecte QUE sur une vraie erreur d'auth (compte/JWT/refresh
      // token invalide → statut 4xx), jamais sur une simple coupure réseau
      // (pas de statut / 5xx), pour ne pas éjecter un nouvel utilisateur OAuth
      // légitime qui n'a pas encore de numéro.
      const status = (error as { status?: number } | null)?.status;
      const invalidSession = !!error && typeof status === 'number' && status >= 400 && status < 500;
      if (!mounted || !invalidSession) return;
      await clearPendingOtp();
      await clearPendingDeepRoute();
      await supabase.auth.signOut({ scope: 'local' });
      router.replace('/(auth)/login');
    })();
    return () => { mounted = false; };
  }, [router]);

  // Retour : l'utilisateur est en pleine création de compte (Apple/Google sans
  // numéro). On le renvoie vers l'espace d'inscription pour recommencer. Sous le
  // capot on invalide la session OAuth à moitié créée (sinon l'AuthGate le
  // ramènerait ici) — mais côté utilisateur il s'agit bien de revenir à
  // l'inscription, pas d'une déconnexion.
  function backToRegister() {
    Alert.alert(
      "Revenir à l'inscription ?",
      "Tu seras redirigé(e) vers l'espace d'inscription afin de recommencer la création de ton compte.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: "Revenir à l'inscription",
          style: 'destructive',
          onPress: async () => {
            // Sortie volontaire : l'AuthGate ne doit pas re-forcer cet écran.
            useAuthStore.getState().beginAuthReset('/(auth)/register');
            await clearPendingOtp();
            await clearPendingDeepRoute();
            // Effacement LOCAL : la session OAuth à moitié créée peut déjà être
            // invalide (compte supprimé) ; scope 'local' garantit la sortie.
            await supabase.auth.signOut({ scope: 'local' });
            router.replace('/(auth)/register');
          },
        },
      ],
    );
  }

  async function sendCode() {
    const raw = phone.replace(/\s/g, '');
    if (!CIV_PHONE.test(raw)) {
      Alert.alert('Numéro invalide', 'Saisis un numéro ivoirien valide (8 à 10 chiffres).');
      return;
    }
    if (!email) {
      Alert.alert('Session expirée', 'Reconnecte-toi puis réessaie.');
      return;
    }
    const full = `+225${raw}`;
    setLoading(true);

    // Empêcher qu'un numéro déjà utilisé par un autre compte soit réutilisé.
    try {
      const { data } = await apiClient.post<{ phoneExists: boolean }>('/api/v1/auth/check-account', { email, phone: full });
      if (data.phoneExists) {
        setLoading(false);
        Alert.alert('Numéro déjà utilisé', 'Ce numéro est associé à un autre compte. Utilise un autre numéro.');
        return;
      }
    } catch {
      // check best-effort : on continue si le backend est injoignable.
    }

    // Envoi du code par SMS (Orange) — vérification du numéro.
    try {
      await apiClient.post('/api/v1/auth/phone/request-otp', { phone: full, purpose: 'verify-phone' });
    } catch (e: unknown) {
      setLoading(false);
      const raw = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join('\n') : raw ?? 'Réessaie dans quelques instants.';
      Alert.alert('Envoi du code impossible', msg);
      return;
    }
    setLoading(false);
    Alert.alert(
      'Code envoyé par SMS',
      `Saisis le code à 6 chiffres envoyé au ${full} par SMS.`,
      [{ text: 'OK', onPress: async () => {
        await setPendingOtp({ email, phone: full, channel: 'sms', purpose: 'verify-phone' });
        router.push({ pathname: '/(auth)/otp', params: { email, phone: full, channel: 'sms', purpose: 'verify-phone' } });
      } }],
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-primary-deep" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground source={require('../../../assets/images/kente-tile.png')} resizeMode="repeat" style={{ flex: 1 }} imageStyle={{ opacity: 0.6 }}>
        {/* Retour / changer de compte (évite de rester bloqué sur cet écran) */}
        <Pressable onPress={backToRegister} hitSlop={12} style={{ position: 'absolute', top: 56, left: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>‹</Text>
        </Pressable>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View className="items-center mb-4">
            <View style={{ shadowColor: '#FFB830', shadowOpacity: 0.7, shadowRadius: 22 }}>
              <Image source={require('../../../assets/images/logo.png')} resizeMode="contain" style={{ width: 88, height: 70 }} />
            </View>
          </View>

          <Text className="text-white text-3xl font-black text-center mb-2">Vérifie ton numéro</Text>
          <Text className="text-white/60 text-center leading-5 mb-8">
            Ton compte a été créé avec {email ? email : 'ton fournisseur'}. Ajoute et vérifie ton numéro de téléphone pour continuer.
          </Text>

          <View className="h-14 rounded-input px-4 flex-row items-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' }}>+225</Text>
            <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.22)', marginHorizontal: 12 }} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Numéro de téléphone *"
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType="phone-pad"
              inputAccessoryViewID={KB_DONE_ID}
              selectionColor="#F7921E"
              style={{ flex: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 20, padding: 0, includeFontPadding: false, textAlignVertical: 'center' }}
            />
          </View>

          <Pressable onPress={sendCode} disabled={loading} className="h-14 rounded-btn items-center justify-center" style={{ backgroundColor: '#F7921E', opacity: loading ? 0.6 : 1 }}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold text-base">Envoyer le code</Text>}
          </Pressable>

          <Text className="text-white/40 text-center text-xs mt-4 leading-5">
            Un code de vérification te sera envoyé (par e-mail pour l’instant, par SMS prochainement).
          </Text>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}
