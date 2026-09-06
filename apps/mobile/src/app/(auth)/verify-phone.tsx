import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ImageBackground, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { KB_DONE_ID } from '../../components/ui/keyboard-done-bar';
import { setPendingOtp, clearPendingOtp } from '../../lib/pending-flow';
import { frenchAuthError } from '../../lib/auth-errors';

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

  // Sortie de secours : cet écran est imposé aux comptes Apple/Google sans
  // numéro. Sans échappatoire, un utilisateur qui ne reçoit pas le code (ex.
  // adresse « Hide My Email » qui ne délivre pas) reste bloqué même après
  // réinstallation (la session persiste). On lui permet de se déconnecter.
  function changeAccount() {
    Alert.alert(
      'Changer de compte ?',
      'Tu seras déconnecté et pourras te reconnecter avec un autre compte ou une adresse e-mail qui reçoit bien les e-mails.',
      [
        { text: 'Rester', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await clearPendingOtp();
            await supabase.auth.signOut();
            router.replace('/(auth)/sign-in');
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

    // Envoi du code par e-mail (canal temporaire en attendant le SMS Orange).
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) {
      Alert.alert('Envoi du code impossible', frenchAuthError(error.message));
      return;
    }
    Alert.alert(
      'Code envoyé par e-mail',
      'La vérification par SMS arrive bientôt. Pour l’instant, saisis le code envoyé à ton adresse e-mail.',
      [{ text: 'OK', onPress: async () => {
        await setPendingOtp({ email, phone: full, channel: 'email', purpose: 'verify-phone' });
        router.push({ pathname: '/(auth)/otp', params: { email, phone: full, channel: 'email', purpose: 'verify-phone' } });
      } }],
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-primary-deep" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground source={require('../../../assets/images/kente-tile.png')} resizeMode="repeat" style={{ flex: 1 }} imageStyle={{ opacity: 0.6 }}>
        {/* Retour / changer de compte (évite de rester bloqué sur cet écran) */}
        <Pressable onPress={changeAccount} hitSlop={12} style={{ position: 'absolute', top: 56, left: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
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
            <Text className="text-white font-bold mr-3">+225</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Numéro de téléphone *"
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType="phone-pad"
              inputAccessoryViewID={KB_DONE_ID}
              selectionColor="#F7921E"
              className="flex-1 text-white text-base"
              style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
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
