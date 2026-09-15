import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AppHeader } from '../../components/ui/app-header';
import { apiClient } from '../../lib/api';
import { imageThumb } from '../../lib/image';
import { RemoteImage } from '../../components/ui/remote-image';
import { supabase } from '../../lib/supabase';

// Palette de base (couleurs de maillot courantes). Modifiable librement.
const PRESET_COLORS = [
  '#1E7A3A', '#F7921E', '#FFB830', '#2563EB', '#DC2626', '#111827',
  '#FFFFFF', '#7C3AED', '#0D9488', '#EA580C', '#65A30D', '#DB2777',
];
const HEX_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

interface ApiTerrain { id: string; name: string; city?: string | null }
interface TeamDetail {
  id: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  home_terrain_id?: string | null;
  home_terrain?: { id?: string | null; name?: string | null; city?: string | null } | null;
}

// Décodage base64 → Uint8Array (upload fiable vers Supabase Storage en RN).
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

export default function EditTeamPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
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
  const [initialLoading, setInitialLoading] = useState(true);

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
      setTerrains([]);
      setTerrainsError(status ? `Erreur ${status} — ${detail}` : `Connexion impossible — ${detail}`);
    } finally {
      setTerrainsLoading(false);
    }
  }, []);

  useEffect(() => { loadTerrains(); }, [loadTerrains]);

  // Pré-remplissage depuis l'équipe existante.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) { setInitialLoading(false); return; }
      try {
        const { data } = await apiClient.get<TeamDetail>(`/api/v1/teams/${id}`);
        if (!mounted) return;
        setTeamName(data.name ?? '');
        if (data.primary_color) setPrimaryColor(data.primary_color.toUpperCase());
        if (data.secondary_color) setSecondaryColor(data.secondary_color.toUpperCase());
        setLogoUrl(data.logo_url ?? '');
        setSelectedTerrain(data.home_terrain_id ?? data.home_terrain?.id ?? '');
      } catch {
        Alert.alert('Erreur', "Impossible de charger l'équipe.");
      } finally {
        if (mounted) setInitialLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

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
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { Alert.alert('Session expirée', 'Reconnecte-toi puis réessaie l\'envoi du logo.'); return; }
      const path = `${sess.session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('teams').upload(path, bytes.buffer as ArrayBuffer, { contentType, upsert: true });
      if (error) { Alert.alert('Échec de l\'envoi du logo', error.message || 'Erreur inconnue côté stockage.'); return; }
      const { data } = supabase.storage.from('teams').getPublicUrl(path);
      if (data?.publicUrl) setLogoUrl(data.publicUrl);
    } catch (e: unknown) {
      Alert.alert('Échec de l\'envoi du logo', e instanceof Error ? e.message : 'Erreur réseau pendant l\'envoi.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!teamName.trim() || !selectedTerrain) {
      Alert.alert('Champs manquants', 'Le nom et le terrain domicile sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.patch(`/api/v1/teams/${id}`, {
        name: teamName.trim(),
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        home_terrain_id: selectedTerrain,
        logo_url: logoUrl || undefined,
      });
      Alert.alert('Équipe mise à jour', 'Les modifications ont été enregistrées.', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/team')) },
      ]);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('Enregistrement impossible', Array.isArray(msg) ? msg.join('\n') : msg ?? 'Réessaie plus tard.');
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

  if (initialLoading) {
    return (
      <ScreenBackground>
        <AppHeader title="Paramètres de l'équipe" onBack={() => router.back()} showLogo={false} centered />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <AppHeader title="Paramètres de l'équipe" onBack={() => router.back()} showLogo={false} centered />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
            <Text className="text-white font-semibold text-sm">Logo de l&apos;équipe</Text>
            <Text className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Touche pour changer le logo</Text>
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
            <Text className="text-white font-semibold text-sm">Couleurs du maillot</Text>
            <View className="flex-row items-center gap-1">
              <View className="w-5 h-5 rounded-md" style={{ backgroundColor: primaryColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
              <View className="w-5 h-5 rounded-md" style={{ backgroundColor: secondaryColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
            </View>
          </View>
          <ColorRow label="Couleur principale (domicile)" value={primaryColor} onSelect={setPrimaryColor} target="primary" />
          <ColorRow label="Couleur secondaire (extérieur)" value={secondaryColor} onSelect={setSecondaryColor} target="secondary" />
        </View>

        {/* Terrain domicile */}
        <View className="mb-6">
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
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleSave}
          disabled={!teamName.trim() || !selectedTerrain || loading || uploading}
          className="h-14 rounded-2xl items-center justify-center"
          style={{ backgroundColor: '#1E7A3A', opacity: !teamName.trim() || !selectedTerrain || loading || uploading ? 0.5 : 1 }}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Enregistrer les modifications</Text>}
        </Pressable>
      </ScrollView>

      {/* Modal couleur personnalisée */}
      <Modal visible={colorModal !== null} transparent animationType="fade" onRequestClose={() => setColorModal(null)}>
        <Pressable onPress={() => setColorModal(null)} className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-2xl p-5" style={{ backgroundColor: '#0D1F0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Text className="text-white font-bold text-base mb-1">Couleur personnalisée</Text>
            <Text className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Entre un code hexadécimal (ex. #1E7A3A).</Text>
            <View className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-xl" style={{ backgroundColor: HEX_RE.test((hexInput.startsWith('#') ? hexInput : `#${hexInput}`)) ? (hexInput.startsWith('#') ? hexInput : `#${hexInput}`) : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
              <TextInput
                value={hexInput}
                onChangeText={setHexInput}
                autoCapitalize="characters"
                placeholder="#1E7A3A"
                placeholderTextColor="rgba(255,255,255,0.3)"
                className="flex-1 h-11 px-3 rounded-xl text-white text-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              />
            </View>
            <View className="flex-row gap-3 mt-5">
              <Pressable onPress={() => setColorModal(null)} className="flex-1 h-11 rounded-xl items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text className="text-white/80 font-semibold text-sm">Annuler</Text>
              </Pressable>
              <Pressable onPress={addCustomColor} className="flex-1 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: '#F7921E' }}>
                <Text className="text-white font-bold text-sm">Ajouter</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenBackground>
  );
}
