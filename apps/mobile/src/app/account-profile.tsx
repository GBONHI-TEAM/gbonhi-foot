import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '../components/ui/app-header';
import { ScreenBackground } from '../components/ui/screen-background';
import { useAuthStore } from '../store/auth.store';
import { supabase } from '../lib/supabase';

const CIV_PHONE = /^\d{8,10}$/;

export default function AccountProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const metadata = useMemo(() => user?.user_metadata ?? {}, [user]);
  const initialName = typeof metadata.full_name === 'string' ? metadata.full_name.trim().split(/\s+/) : [];
  const [firstName, setFirstName] = useState(initialName[0] ?? '');
  const [lastName, setLastName] = useState(initialName.slice(1).join(' '));
  const [phone, setPhone] = useState(typeof metadata.phone === 'string' ? metadata.phone.replace(/^\+225/, '') : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);

  async function saveAccount() {
    if (!firstName.trim() || !lastName.trim() || !CIV_PHONE.test(phone.replace(/\s/g, ''))) {
      Alert.alert('Profil incomplet', 'Renseigne ton prénom, ton nom et un numéro ivoirien valide.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Profil incomplet', 'Renseigne une adresse e-mail valide.');
      return;
    }

    setSaving(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const payload: { data: Record<string, string>; email?: string } = {
      data: { full_name: fullName, phone: `+225${phone.replace(/\s/g, '')}` },
    };
    if (email.trim().toLowerCase() !== user?.email?.toLowerCase()) payload.email = email.trim();

    const { error } = await supabase.auth.updateUser(payload);
    setSaving(false);
    if (error) {
      Alert.alert('Mise à jour impossible', error.message);
      return;
    }
    Alert.alert(
      'Profil mis à jour',
      payload.email ? 'Un e-mail de confirmation a été envoyé à ta nouvelle adresse.' : 'Tes informations de compte sont enregistrées.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <ScreenBackground>
      <AppHeader title="Modifier le profil" onBack={() => router.back()} showLogo={false} centered />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 42 }} keyboardShouldPersistTaps="handled">
          <Text className="text-white/65 leading-5 mb-2">Ces informations concernent ton compte GBONHI FOOT. Elles sont distinctes de ta fiche joueur et de tes informations football.</Text>
          <TextInput value={firstName} onChangeText={setFirstName} placeholder="Prénom *" placeholderTextColor="rgba(255,255,255,0.45)" autoCapitalize="words" className="h-14 rounded-input px-4 text-white text-base" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
          <TextInput value={lastName} onChangeText={setLastName} placeholder="Nom *" placeholderTextColor="rgba(255,255,255,0.45)" autoCapitalize="words" className="h-14 rounded-input px-4 text-white text-base" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
          <View className="h-14 rounded-input px-4 flex-row items-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
            <Text className="text-white font-bold mr-3">+225</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="Numéro de téléphone *" placeholderTextColor="rgba(255,255,255,0.45)" keyboardType="phone-pad" className="flex-1 text-white text-base" />
          </View>
          <TextInput value={email} onChangeText={setEmail} placeholder="Adresse e-mail *" placeholderTextColor="rgba(255,255,255,0.45)" keyboardType="email-address" autoCapitalize="none" className="h-14 rounded-input px-4 text-white text-base" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
          <Pressable onPress={saveAccount} disabled={saving} className="h-14 rounded-btn items-center justify-center mt-4" style={{ backgroundColor: '#F7921E', opacity: saving ? 0.6 : 1 }}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold text-base">Enregistrer mon profil</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
