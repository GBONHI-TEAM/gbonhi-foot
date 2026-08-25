import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { imageThumb } from '../../lib/image';
import { RemoteImage } from '../../components/ui/remote-image';
import { ScreenBackground } from '../../components/ui/screen-background';
import { useAuthStore } from '../../store/auth.store';
import { PatternedGreenHeader } from '../../components/ui/patterned-green-header';

interface MyTeam { id: string; name: string }

function initials(name?: string | null) {
  return (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// Décodage base64 → Uint8Array (upload fiable Supabase Storage en RN).
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

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const authorName = (user?.user_metadata?.full_name as string | undefined)?.trim() || 'Moi';

  const [content, setContent] = useState('');
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get<{ teams?: MyTeam[] }>('/api/v1/users/me/summary')
      .then((r) => setTeams(r.data?.teams ?? []))
      .catch(() => setTeams([]));
  }, []);

  const teamName = teams.find((t) => t.id === selectedTeam)?.name;

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', "Autorise l'accès aux photos."); return; }
    // allowsEditing → iOS redimensionne l'image (évite les fichiers trop lourds
    // qui font échouer l'upload avec « Network request failed »). quality 0.6
    // ré-encode le JPEG pour alléger encore le fichier.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.6, base64: true });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const bytes = base64ToBytes(asset.base64!);
      // Garde-fou : au-delà de ~4 Mo, l'upload mobile est peu fiable.
      if (bytes.length > 4 * 1024 * 1024) {
        Alert.alert('Photo trop lourde', 'Choisis une image plus légère (recadre-la ou réduis la qualité).');
        return;
      }
      const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase() === 'png' ? 'png' : 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('community').upload(path, bytes.buffer as ArrayBuffer, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      });
      if (error) { console.log('[post image] error', JSON.stringify(error)); Alert.alert('Échec de l\'envoi', error.message); return; }
      const { data } = supabase.storage.from('community').getPublicUrl(path);
      if (data?.publicUrl) setImageUrl(data.publicUrl);
    } catch (e) {
      console.log('[post image] exception', e instanceof Error ? e.message : String(e));
      Alert.alert('Échec de l\'envoi', e instanceof Error ? e.message : 'Réessaie avec une photo plus légère.');
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (!content.trim()) {
      Alert.alert('Publication vide', 'Écris quelque chose avant de publier.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/api/v1/community/posts', {
        content: content.trim(),
        image_url: imageUrl || undefined,
        team_id: selectedTeam || undefined,
      });
      router.back();
    } catch {
      Alert.alert('Erreur', 'Publication impossible. Réessaie.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenBackground>
      {/* Header vert à motifs triangulaires + croix */}
      <PatternedGreenHeader
        style={{ paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' }}
        patternOpacity={0.5}
      >
        <View className="flex-row items-center">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community'))} hitSlop={8} style={{ width: 32 }}>
            <Text className="text-white text-2xl">✕</Text>
          </Pressable>
          <Text className="text-white font-black text-xl flex-1 text-center" style={{ marginRight: 32 }}>Nouveau post</Text>
        </View>
      </PatternedGreenHeader>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Auteur */}
        <View className="flex-row items-center gap-3 mb-4">
          <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
            <Text className="text-white font-bold">{initials(authorName)}</Text>
          </View>
          <View>
            <Text className="text-white font-bold text-base">{authorName}</Text>
            {teamName ? <Text className="text-white/50 text-sm">{teamName}</Text> : null}
          </View>
        </View>

        {/* Zone texte */}
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Quoi de neuf sur les terrains ?"
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
          autoFocus
          style={{ minHeight: 150, color: '#fff', fontSize: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 16, textAlignVertical: 'top' }}
        />
        <Text className="text-white/40 text-xs mt-1.5 mb-4">{content.length}/1000</Text>

        {/* Photo */}
        <Pressable
          onPress={pickImage}
          className="rounded-2xl items-center justify-center mb-6"
          style={{ height: 150, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}
        >
          {uploading ? (
            <ActivityIndicator color="#F7921E" />
          ) : imageUrl ? (
            <>
              <RemoteImage uri={imageThumb(imageUrl, 800)} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View className="absolute px-3 py-1.5 rounded-full" style={{ bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <Text className="text-white text-xs font-semibold">Changer la photo</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 30, color: 'rgba(255,255,255,0.4)' }}>🖼</Text>
              <Text className="text-white/50 text-sm mt-2">Ajouter une photo</Text>
            </>
          )}
        </Pressable>

        {/* Taguer */}
        {teams.length > 0 ? (
          <>
            <Text className="text-white font-bold text-base mb-3">Taguer</Text>
            <View className="flex-row flex-wrap gap-3">
              {teams.map((t) => {
                const active = selectedTeam === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedTeam(active ? null : t.id)}
                    className="flex-row items-center gap-2 px-4 py-2.5 rounded-full"
                    style={{ backgroundColor: active ? 'rgba(30,122,58,0.15)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: active ? '#2E9E4F' : 'rgba(255,255,255,0.15)' }}
                  >
                    <Text>🛡️</Text>
                    <Text className="text-sm font-semibold" style={{ color: active ? '#4ADE80' : 'rgba(255,255,255,0.7)' }}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Actions bas */}
      <View className="px-5 pb-8 pt-2" style={{ backgroundColor: '#0D1F0D' }}>
        <Pressable
          onPress={publish}
          disabled={saving}
          className="h-14 rounded-btn items-center justify-center"
          style={{ backgroundColor: '#F7921E', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Publier</Text>}
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
