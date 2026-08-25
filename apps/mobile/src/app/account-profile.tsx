import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader } from '../components/ui/app-header';
import { ScreenBackground } from '../components/ui/screen-background';
import { RemoteImage } from '../components/ui/remote-image';
import { imageThumb } from '../lib/image';
import { useAuthStore } from '../store/auth.store';
import { supabase } from '../lib/supabase';

const CIV_PHONE = /^\d{8,10}$/;

// Décodage base64 → octets (upload fiable Supabase Storage en RN).
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let len = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') { len--; if (base64[base64.length - 2] === '=') len--; }
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const e1 = lookup[base64.charCodeAt(i)];
    const e2 = lookup[base64.charCodeAt(i + 1)];
    const e3 = lookup[base64.charCodeAt(i + 2)];
    const e4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (base64.charCodeAt(i + 2) !== 61) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (base64.charCodeAt(i + 3) !== 61) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?';
}

export default function AccountProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const metadata = useMemo(() => user?.user_metadata ?? {}, [user]);
  const initialName = typeof metadata.full_name === 'string' ? metadata.full_name.trim().split(/\s+/) : [];
  const [firstName, setFirstName] = useState(initialName[0] ?? '');
  const [lastName, setLastName] = useState(initialName.slice(1).join(' '));
  const [phone, setPhone] = useState(typeof metadata.phone === 'string' ? metadata.phone.replace(/^\+225/, '') : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [photoUri, setPhotoUri] = useState(typeof metadata.photo_url === 'string' ? metadata.photo_url.trim() : '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', "Autorise l'accès aux photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const bytes = base64ToBytes(asset.base64!);
      const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase() === 'png' ? 'png' : 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, bytes.buffer as ArrayBuffer, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      });
      if (error) { Alert.alert('Échec de l\'envoi', error.message); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      if (data?.publicUrl) setPhotoUri(data.publicUrl);
    } catch (e) {
      Alert.alert('Échec de l\'envoi', e instanceof Error ? e.message : 'Réessaie avec une autre photo.');
    } finally {
      setUploading(false);
    }
  }

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
      data: { full_name: fullName, phone: `+225${phone.replace(/\s/g, '')}`, photo_url: photoUri },
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
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 42 }} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text className="text-white/65 leading-5 mb-2">Ces informations concernent ton compte GBONHI FOOT. Elles sont distinctes de ta fiche joueur et de tes informations football.</Text>

          {/* Photo de profil */}
          <View className="items-center mb-2">
            <Pressable onPress={pickAvatar} disabled={uploading}>
              <View className="rounded-full items-center justify-center overflow-hidden" style={{ width: 104, height: 104, backgroundColor: '#1E7A3A', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}>
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : photoUri ? (
                  <RemoteImage uri={imageThumb(photoUri, 220)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text className="text-white font-black" style={{ fontSize: 32 }}>{initials(firstName, lastName)}</Text>
                )}
              </View>
              <View className="absolute" style={{ right: -2, bottom: -2, backgroundColor: '#F7921E', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0D1F0D' }}>
                <Text style={{ fontSize: 15 }}>📷</Text>
              </View>
            </Pressable>
            <Pressable onPress={pickAvatar} disabled={uploading} className="mt-2">
              <Text className="text-sm font-semibold" style={{ color: '#F7921E' }}>{photoUri ? 'Changer la photo' : 'Ajouter une photo'}</Text>
            </Pressable>
          </View>

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
