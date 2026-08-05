import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AppHeader } from '../../components/ui/app-header';
import { apiClient } from '../../lib/api';
import { imageThumb } from '../../lib/image';
import { RemoteImage } from '../../components/ui/remote-image';
import { supabase } from '../../lib/supabase';

// Palette de base (couleurs de maillot courantes). L'utilisateur peut en ajouter d'autres.
const PRESET_COLORS = [
  '#1E7A3A', '#F7921E', '#FFB830', '#2563EB', '#DC2626', '#111827',
  '#FFFFFF', '#7C3AED', '#0D9488', '#EA580C', '#65A30D', '#DB2777',
];
const HEX_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

interface ApiTerrain { id: string; name: string; city?: string | null }

// Décodage base64 → Uint8Array (upload fiable vers Supabase Storage en RN, sans dépendance).
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

export default function CreateTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1E7A3A');
  const [secondaryColor, setSecondaryColor] = useState('#F7921E');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [colorModal, setColorModal] = useState<null | 'primary' | 'secondary'>(null);
  const [hexInput, setHexInput] = useState('');
  const [terrains, setTerrains] = useState<ApiTerrain[]>([]);
  const [terrainsError, setTerrainsError] = useState('');
  const [terrainsLoading, setTerrainsLoading] = useState(true);
  const [selectedTerrain, setSelectedTerrain] = useState('');
  const [terrainOpen, setTerrainOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadTerrains = useCallback(async () => {
    setTerrainsLoading(true);
    setTerrainsError('');
    try {
      const r = await apiClient.get<ApiTerrain[]>('/api/v1/terrains');
      const list = Array.isArray(r.data) ? r.data : [];
      setTerrains(list);
      if (list.length === 0) setTerrainsError('Aucun terrain partenaire actif pour le moment.');
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = err?.response?.status;
      const detail = err?.response?.data?.message || err?.message || 'Erreur réseau';
      console.log('[terrains] fetch error', status, detail);
      setTerrains([]);
      setTerrainsError(status ? `Erreur ${status} — ${detail}` : `Connexion impossible — ${detail}`);
    } finally {
      setTerrainsLoading(false);
    }
  }, []);

  useEffect(() => { loadTerrains(); }, [loadTerrains]);

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', "Autorise l'accès aux photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const bytes = base64ToBytes(asset.base64!);
      const rawExt = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const ext = rawExt === 'png' ? 'png' : 'jpg';
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Vérifie qu'une session est bien présente (le bucket exige le rôle authenticated).
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        Alert.alert('Session expirée', 'Reconnecte-toi puis réessaie l\'envoi du logo.');
        return;
      }

      const { error } = await supabase.storage.from('teams').upload(path, bytes.buffer as ArrayBuffer, { contentType, upsert: true });
      if (error) {
        console.log('[team logo upload] error =', JSON.stringify(error));
        Alert.alert('Échec de l\'envoi du logo', error.message || 'Erreur inconnue côté stockage.');
        return;
      }
      const { data } = supabase.storage.from('teams').getPublicUrl(path);
      if (data?.publicUrl) setLogoUrl(data.publicUrl);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur réseau pendant l\'envoi.';
      console.log('[team logo upload] exception =', msg);
      Alert.alert('Échec de l\'envoi du logo', msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate() {
    if (!logoUrl || !teamName.trim() || !selectedTerrain) {
      Alert.alert('Équipe incomplète', 'Ajoute un logo, le nom de l’équipe et son terrain domicile.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post<{ id: string; name: string; invitation_code?: string | null }>('/api/v1/teams', {
        name: teamName.trim(),
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        home_terrain_id: selectedTerrain,
        logo_url: logoUrl || undefined,
      });
      router.replace({ pathname: '/team/success', params: { code: data.invitation_code ?? '', name: data.name } });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('Création impossible', Array.isArray(msg) ? msg.join('\n') : msg ?? 'Réessaie plus tard.');
    } finally {
      setLoading(false);
    }
  }

  const allColors = [...PRESET_COLORS, ...customColors];

  function addCustomColor() {
    let v = hexInput.trim();
    if (v && !v.startsWith('#')) v = `#${v}`;
    if (!HEX_RE.test(v)) { Alert.alert('Couleur invalide', 'Entre un code hexadécimal, ex. #1E7A3A'); return; }
    if (!allColors.includes(v.toUpperCase())) setCustomColors((c) => [...c, v.toUpperCase()]);
    if (colorModal === 'primary') setPrimaryColor(v.toUpperCase());
    else if (colorModal === 'secondary') setSecondaryColor(v.toUpperCase());
    setHexInput('');
    setColorModal(null);
  }

  function ColorRow({ label, value, onSelect, target }: { label: string; value: string; onSelect: (c: string) => void; target: 'primary' | 'secondary' }) {
    return (
      <View className="mb-4">
        <Text className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</Text>
        <View className="flex-row gap-2.5 flex-wrap">
          {allColors.map((color) => (
            <Pressable
              key={color}
              onPress={() => onSelect(color)}
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: color, borderWidth: value === color ? 3 : 1, borderColor: value === color ? '#FFB830' : 'rgba(255,255,255,0.15)' }}
            >
              {value === color ? <Text style={{ color: color === '#FFFFFF' ? '#111' : '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text> : null}
            </Pressable>
          ))}
          <Pressable onPress={() => { setHexInput(''); setColorModal(target); }} className="w-10 h-10 rounded-xl items-center justify-center" style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const terrainLabel = terrains.find((t) => t.id === selectedTerrain)
    ? `${terrains.find((t) => t.id === selectedTerrain)!.name}${terrains.find((t) => t.id === selectedTerrain)!.city ? ` · ${terrains.find((t) => t.id === selectedTerrain)!.city}` : ''}`
    : 'Sélectionne un terrain partenaire';

  return (
    <ScreenBackground>
      <AppHeader title="Créer une équipe" onBack={() => router.back()} showLogo={false} centered />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Logo picker */}
        <View className="flex-row items-center gap-4 mb-6">
          <Pressable
            onPress={pickLogo}
            className="w-20 h-20 rounded-2xl items-center justify-center overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            {uploading ? (
              <ActivityIndicator color="#F7921E" />
            ) : logoUrl ? (
              <RemoteImage uri={imageThumb(logoUrl, 200)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }}>🖼</Text>
            )}
          </Pressable>
          <View>
            <Text className="text-white font-semibold text-sm">Logo de l&apos;équipe *</Text>
            <Text className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              PNG ou JPG, format carré recommandé
            </Text>
          </View>
        </View>

        {/* Team name */}
        <View className="mb-5">
          <Text className="text-white font-semibold text-sm mb-2">Nom de l&apos;équipe *</Text>
          <TextInput
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Ex. GBONHI FC"
            placeholderTextColor="rgba(255,255,255,0.3)"
            className="h-12 px-4 rounded-xl text-white text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          />
        </View>

        {/* Colors */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white font-semibold text-sm">Couleurs du maillot *</Text>
            {/* Aperçu de la palette choisie */}
            <View className="flex-row items-center gap-1">
              <View className="w-5 h-5 rounded-md" style={{ backgroundColor: primaryColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
              <View className="w-5 h-5 rounded-md" style={{ backgroundColor: secondaryColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
            </View>
          </View>
          <ColorRow label="Couleur principale" value={primaryColor} onSelect={setPrimaryColor} target="primary" />
          <ColorRow label="Couleur secondaire" value={secondaryColor} onSelect={setSecondaryColor} target="secondary" />
        </View>

        {/* Terrain domicile */}
        <View className="mb-5">
          <Text className="text-white font-semibold text-sm mb-2">Terrain domicile *</Text>
          <Pressable
            onPress={() => setTerrainOpen(!terrainOpen)}
            className="h-12 px-4 rounded-xl flex-row items-center justify-between"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Text className="text-sm flex-1" style={{ color: selectedTerrain ? 'white' : 'rgba(255,255,255,0.35)' }}>{terrainLabel}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)' }}>▾</Text>
          </Pressable>

          {terrainOpen && (
            <View className="rounded-xl mt-1 overflow-hidden" style={{ backgroundColor: 'rgba(30,122,58,0.95)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              {terrainsLoading ? (
                <View className="px-4 py-3 flex-row items-center gap-2"><ActivityIndicator color="#F7921E" /><Text className="text-white/70 text-sm">Chargement…</Text></View>
              ) : terrains.length === 0 ? (
                <Pressable onPress={loadTerrains} className="px-4 py-3">
                  <Text className="text-white/70 text-sm">{terrainsError || 'Aucun terrain disponible.'}</Text>
                  <Text className="text-xs mt-1" style={{ color: '#F7921E' }}>Toucher pour réessayer</Text>
                </Pressable>
              ) : terrains.map((t) => (
                <Pressable key={t.id} onPress={() => { setSelectedTerrain(t.id); setTerrainOpen(false); }} className="px-4 py-3 border-b active:opacity-70" style={{ borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                  <Text className="text-white text-sm">{t.name}{t.city ? ` · ${t.city}` : ''}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {terrainsError && !terrainOpen ? (
            <Pressable onPress={loadTerrains} className="flex-row items-center gap-1.5 mt-2">
              <Text style={{ color: '#F87171', fontSize: 10 }}>⚠</Text>
              <Text className="text-xs" style={{ color: '#F87171' }}>{terrainsError} · toucher pour réessayer</Text>
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-1.5 mt-2">
              <Text style={{ color: '#F7921E', fontSize: 10 }}>ℹ</Text>
              <Text className="text-xs" style={{ color: '#F7921E' }}>Obligatoire pour participer aux ligues</Text>
            </View>
          )}
        </View>

        {/* Invite section */}
        <View className="mb-8">
          <Text className="text-white font-semibold text-sm mb-2">Inviter des joueurs</Text>
          <Pressable
            onPress={() => Alert.alert('Invitation', "Un code et un lien d'invitation uniques sont générés dès la création de l'équipe. Tu pourras les partager à l'écran suivant (par code ou par lien).")}
            className="flex-row items-center gap-3 px-4 py-3.5 rounded-xl"
            style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
              <Text className="text-white">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-medium">Par code ou par lien</Text>
              <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Généré à la création · partage à l&apos;écran suivant</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.35)' }}>ℹ</Text>
          </Pressable>
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleCreate}
          disabled={!logoUrl || !teamName.trim() || !selectedTerrain || loading}
          className="h-14 rounded-2xl items-center justify-center"
          style={{ backgroundColor: '#F7921E', opacity: !logoUrl || !teamName.trim() || !selectedTerrain ? 0.5 : 1 }}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Créer l&apos;équipe</Text>}
        </Pressable>

        <Text className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Tous les champs marqués * sont obligatoires</Text>
      </ScrollView>

      {/* Modal couleur personnalisée */}
      <Modal visible={colorModal !== null} transparent animationType="fade" onRequestClose={() => setColorModal(null)}>
        <Pressable onPress={() => setColorModal(null)} className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-2xl p-5" style={{ backgroundColor: '#0D1F0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Text className="text-white font-bold text-base mb-1">Couleur personnalisée</Text>
            <Text className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {colorModal === 'primary' ? 'Couleur principale' : 'Couleur secondaire'} · code hexadécimal
            </Text>
            <View className="flex-row items-center gap-3 mb-5">
              <View className="w-12 h-12 rounded-xl" style={{ backgroundColor: HEX_RE.test(hexInput.startsWith('#') ? hexInput : `#${hexInput}`) ? (hexInput.startsWith('#') ? hexInput : `#${hexInput}`) : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
              <TextInput
                value={hexInput}
                onChangeText={setHexInput}
                placeholder="#1E7A3A"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="characters"
                autoCorrect={false}
                className="flex-1 h-12 px-4 rounded-xl text-white text-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
              />
            </View>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setColorModal(null)} className="flex-1 h-12 rounded-xl items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text className="text-white font-semibold text-sm">Annuler</Text>
              </Pressable>
              <Pressable onPress={addCustomColor} className="flex-1 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: '#F7921E' }}>
                <Text className="text-white font-bold text-sm">Ajouter</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenBackground>
  );
}
