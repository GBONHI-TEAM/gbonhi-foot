import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RemoteImage } from '../../components/ui/remote-image';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../store/auth.store';
import { useUserModeStore } from '../../store/user-mode.store';
import { supabase } from '../../lib/supabase';
import { apiClient, PUBLIC_LINK_BASE } from '../../lib/api';

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

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Erreur inconnue côté stockage.';
}

const PIED_FORT = ['Droit', 'Gauche'];
const POSTES = [
  'Gardien',
  'Défenseur central',
  'Latéral droit',
  'Latéral gauche',
  'Milieu',
  'Ailier droit',
  'Ailier gauche',
  'Attaquant',
];
const NIVEAUX = ['Débutant', 'Intermédiaire', 'Avancé', 'Semi-pro'];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-accent text-sm font-bold uppercase tracking-widest mt-6 mb-3">
      {children}
    </Text>
  );
}

function DropdownField({
  placeholder,
  value,
  options,
  onSelect,
}: {
  placeholder: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="h-14 rounded-input border border-white/20 bg-white/[0.08] px-4 flex-row items-center justify-between"
      >
        <Text className={value ? 'text-white text-base' : 'text-white/45 text-base'}>
          {value || placeholder}
        </Text>
        <Text className="text-white/45">{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View className="mt-1 rounded-input border border-white/20 bg-primary-dark overflow-hidden">
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(opt); setOpen(false); }}
              className="px-4 py-3 border-b border-white/10 active:bg-white/10"
            >
              <Text className={`text-base ${value === opt ? 'text-accent font-semibold' : 'text-white'}`}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PlayerProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [photoUri, setPhotoUri] = useState('');
  const [uploading, setUploading] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [taille, setTaille] = useState('');
  const [poids, setPoids] = useState('');
  const [piedFort, setPiedFort] = useState('');
  const [poste, setPoste] = useState('');
  const [posteSecondaire, setPosteSecondaire] = useState('');
  const [niveau, setNiveau] = useState('');
  const [infos, setInfos] = useState('');
  const [loading, setLoading] = useState(false);

  // Carte publique : stats calculées + visibilité + lien de partage.
  const [stats, setStats] = useState<{ goals: number; assists: number; matches_played: number } | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get<{
          player_public?: boolean;
          player_share_slug?: string | null;
          statistics?: { goals: number; assists: number; matches_played: number };
        }>('/api/v1/users/me/player-card');
        if (data?.statistics) setStats(data.statistics);
        setIsPublic(data?.player_public === true);
        setShareSlug(data?.player_share_slug ?? null);
      } catch {
        /* la carte reste éditable même si les stats ne chargent pas */
      }
    })();
  }, []);

  async function togglePublic(next: boolean) {
    if (savingVisibility) return;
    setSavingVisibility(true);
    setIsPublic(next); // optimiste
    try {
      const { data } = await apiClient.patch<{ is_public: boolean; slug: string | null }>(
        '/api/v1/users/me/player-visibility',
        { is_public: next },
      );
      setIsPublic(data.is_public);
      if (data.slug) setShareSlug(data.slug);
    } catch {
      setIsPublic(!next); // rollback
      Alert.alert('Action impossible', 'Réessaie dans un instant.');
    } finally {
      setSavingVisibility(false);
    }
  }

  async function shareCard() {
    if (!shareSlug) {
      Alert.alert('Carte privée', 'Active « Carte publique » pour obtenir ton lien de partage.');
      return;
    }
    const url = `${PUBLIC_LINK_BASE}/p/${shareSlug}`;
    try {
      await Share.share({
        message: `Voici ma carte de joueur sur GBONHI FOOT : ${url}`,
        url,
      });
    } catch {
      /* partage annulé */
    }
  }

  // Pré-remplir la fiche depuis le compte connecté :
  //  - Prénom / Nom depuis full_name (saisi à l'inscription).
  //  - En ÉDITION, tous les champs déjà enregistrés dans user_metadata, pour
  //    que l'utilisateur retrouve et modifie sa fiche existante.
  // N'écrase jamais une saisie déjà faite par l'utilisateur dans l'écran.
  useEffect(() => {
    const meta = user?.user_metadata ?? {};
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const fullName = str(meta.full_name).trim();
    if (fullName) {
      const parts = fullName.split(/\s+/);
      setPrenom((p) => p || parts[0] || '');
      setNom((n) => n || parts.slice(1).join(' '));
    }
    const existingPhoto = str(meta.photo_url).trim();
    if (existingPhoto.startsWith('http')) setPhotoUri((p) => p || existingPhoto);
    setDateNaissance((v) => v || str(meta.birth_date));
    setTaille((v) => v || str(meta.height_cm));
    setPoids((v) => v || str(meta.weight_kg));
    setPiedFort((v) => v || str(meta.preferred_foot));
    setPoste((v) => v || str(meta.position));
    setPosteSecondaire((v) => v || str(meta.secondary_position));
    setNiveau((v) => v || str(meta.level));
    setInfos((v) => v || str(meta.extra_info));
  }, [user]);

  // Upload de la photo choisie vers Supabase Storage (bucket `avatars`, public)
  // puis on conserve l'URL PUBLIQUE (pas l'URI locale) → elle s'affiche partout.
  async function uploadAvatar(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.base64) {
      Alert.alert('Photo indisponible', 'La photo sélectionnée ne peut pas être lue. Réessaie avec une autre image.');
      return;
    }
    setUploading(true);
    try {
      const bytes = base64ToBytes(asset.base64);
      const rawExt = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const ext = rawExt === 'png' ? 'png' : 'jpg';
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        Alert.alert('Session expirée', 'Reconnecte-toi puis réessaie l\'envoi de la photo.');
        return;
      }

      let uploadError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const { error } = await supabase.storage
            .from('avatars')
            .upload(path, bytes.buffer as ArrayBuffer, { contentType, upsert: true });
          if (!error) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(path);
            if (data?.publicUrl) setPhotoUri(data.publicUrl);
            return;
          }
          uploadError = error;
        } catch (error: unknown) {
          uploadError = error;
        }

        if (attempt < 3) await waitForRetry(attempt * 900);
      }

      const message = uploadErrorMessage(uploadError);
      console.log('[avatar upload] error =', message);
      const isNetworkFailure = /network request failed|network|timeout/i.test(message);
      Alert.alert(
        isNetworkFailure ? 'Connexion au stockage impossible' : 'Échec de l\'envoi de la photo',
        isNetworkFailure
          ? 'Vérifie la connexion Internet puis réessaie. Si le problème persiste, relance l’application.'
          : message,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur réseau pendant l\'envoi.';
      console.log('[avatar upload] exception =', msg);
      Alert.alert('Échec de l\'envoi de la photo', msg);
    } finally {
      setUploading(false);
    }
  }

  async function launchGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorise l'accès aux photos pour choisir une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) await uploadAvatar(result.assets[0]);
  }

  async function launchCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorise l'accès à l'appareil photo pour prendre une photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) await uploadAvatar(result.assets[0]);
  }

  function pickPhoto() {
    Alert.alert('Photo de profil', 'Choisis une source', [
      { text: 'Appareil photo', onPress: launchCamera },
      { text: 'Galerie', onPress: launchGallery },
      ...(photoUri ? [{ text: 'Supprimer la photo', style: 'destructive' as const, onPress: () => setPhotoUri('') }] : []),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  }

  const { setMode } = useUserModeStore();

  async function handleSave() {
    const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateNaissance);
    const birthDate = dateMatch
      ? new Date(Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]))
      : null;
    const validBirthDate = Boolean(
      birthDate
      && birthDate.getFullYear() === Number(dateMatch?.[3])
      && birthDate.getMonth() === Number(dateMatch?.[2]) - 1
      && birthDate.getDate() === Number(dateMatch?.[1])
      && birthDate <= new Date(),
    );
    const height = Number(taille);
    const weight = Number(poids);

    if (!photoUri || !prenom.trim() || !nom.trim() || !dateNaissance || !taille || !poids || !piedFort || !poste || !niveau) {
      Alert.alert('Fiche incomplète', 'Ajoute la photo et renseigne tous les champs obligatoires (*).');
      return;
    }
    if (!validBirthDate) {
      Alert.alert('Fiche incomplète', 'La date de naissance doit respecter le format jj/mm/aaaa et être valide.');
      return;
    }
    if (!Number.isInteger(height) || height < 100 || height > 250 || !Number.isInteger(weight) || weight < 25 || weight > 250) {
      Alert.alert('Fiche incomplète', 'Renseigne une taille (100–250 cm) et un poids (25–250 kg) valides.');
      return;
    }
    setLoading(true);
    const fullName = `${prenom} ${nom}`.trim();

    // 1) Persister la fiche joueur + marquer comme complétée (Section 3).
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        birth_date: dateNaissance,
        height_cm: taille,
        weight_kg: poids,
        preferred_foot: piedFort,
        position: poste,
        secondary_position: posteSecondaire || null,
        level: niveau,
        extra_info: infos || null,
        photo_url: photoUri || null,
        player_profile_completed: true,
      },
    });
    if (error) {
      setLoading(false);
      Alert.alert('Erreur', error.message);
      return;
    }

    // 2) Miroir des champs de base vers le profil BO (best-effort).
    try {
      await apiClient.patch('/api/v1/users/me', {
        full_name: fullName,
        position: poste,
        avatar_url: photoUri,
      });
    } catch {
      // non bloquant
    }

    // 2b) Rafraîchir la session en mémoire pour que le flag soit vu immédiatement
    // (évite une redirection en boucle vers la fiche).
    const { data: sess } = await supabase.auth.getSession();
    useAuthStore.getState().setSession(sess.session);

    setLoading(false);
    // 3) Mode Ligue. Première création → accueil (onboarding) ; simple modification
    // depuis le profil → retour au Profil.
    setMode('leagues');
    const wasCompleted = user?.user_metadata?.player_profile_completed === true;
    router.replace(wasCompleted ? '/(tabs)/profile' : '/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary-deep"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImageBackground
        source={require('../../../assets/images/kente-tile.png')}
        resizeMode="repeat"
        style={{ flex: 1 }}
        imageStyle={{ opacity: 0.62 }}
      >
        {/* Flèche de retour (reste fixe au-dessus du contenu qui défile) */}
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ position: 'absolute', top: 52, left: 20, zIndex: 20, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 22, marginTop: -2 }}>←</Text>
          </Pressable>
        ) : null}
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 56, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Logo officiel GBONHI FOOT centré avec halo doré (maquette s07) */}
        <View className="items-center mb-3">
          <View
            style={{
              shadowColor: '#FFB830',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 22,
              elevation: 12,
            }}
          >
            <Image
              source={require('../../../assets/images/logo.png')}
              resizeMode="contain"
              style={{ width: 92, height: 72 }}
            />
          </View>
        </View>

        <Text className="text-white text-3xl font-black text-center mb-6">Ta fiche joueur</Text>

        {/* Photo de profil */}
        <Pressable onPress={pickPhoto} className="items-center mb-2">
          <View
            className="w-28 h-28 rounded-full border-2 border-dashed border-white/40 items-center justify-center overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            {uploading ? (
              <ActivityIndicator color="#F7921E" />
            ) : photoUri ? (
              <RemoteImage uri={photoUri} contentFit="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={{ fontSize: 34 }}>📷</Text>
            )}
          </View>
          <Text className="text-white/70 text-sm mt-2">
            {uploading ? 'Envoi en cours…' : photoUri ? 'Modifier la photo' : 'Ajouter une photo'} <Text className="text-accent">*</Text>
          </Text>
        </Pressable>

        {/* IDENTITÉ */}
        <SectionLabel>Identité</SectionLabel>
        <View className="gap-3">
          <Input placeholder="Prénom *" value={prenom} onChangeText={setPrenom} autoCapitalize="words" />
          <Input placeholder="Nom *" value={nom} onChangeText={setNom} autoCapitalize="words" />
          <Input
            placeholder="jj/mm/aaaa *"
            value={dateNaissance}
            onChangeText={setDateNaissance}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* PHYSIQUE */}
        <SectionLabel>Physique</SectionLabel>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input placeholder="Taille *   cm" value={taille} onChangeText={setTaille} keyboardType="numeric" />
          </View>
          <View className="flex-1">
            <Input placeholder="Poids *   kg" value={poids} onChangeText={setPoids} keyboardType="numeric" />
          </View>
        </View>

        {/* TECHNIQUE */}
        <SectionLabel>Technique</SectionLabel>
        <View className="gap-3">
          <DropdownField placeholder="Pied fort *" value={piedFort} options={PIED_FORT} onSelect={setPiedFort} />
          <DropdownField placeholder="Poste préféré *" value={poste} options={POSTES} onSelect={setPoste} />
          <DropdownField
            placeholder="Poste secondaire (optionnel)"
            value={posteSecondaire}
            options={['Aucun', ...POSTES]}
            onSelect={setPosteSecondaire}
          />
          <DropdownField placeholder="Niveau de jeu *" value={niveau} options={NIVEAUX} onSelect={setNiveau} />
          <Input
            placeholder="Informations supplémentaires (optionnel)"
            value={infos}
            onChangeText={setInfos}
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />
        </View>

        {/* Ma carte publique : stats calculées + visibilité + partage */}
        <View className="mt-6 rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text className="text-white font-black text-base mb-3">Ma carte de joueur</Text>

          <View className="flex-row gap-2 mb-4">
            {[
              { label: 'Buts', value: stats?.goals ?? 0 },
              { label: 'Passes', value: stats?.assists ?? 0 },
              { label: 'Matchs', value: stats?.matches_played ?? 0 },
            ].map((s) => (
              <View key={s.label} className="flex-1 items-center rounded-xl py-3" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
                <Text className="font-black text-2xl" style={{ color: '#FFB830' }}>{s.value}</Text>
                <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1 pr-3">
              <Text className="text-white font-semibold text-sm">Carte publique</Text>
              <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Rends ta carte visible via un lien à partager (capitaine, recruteur…).
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={togglePublic}
              disabled={savingVisibility}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#2E9E4F' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Pressable
            onPress={shareCard}
            disabled={!isPublic}
            className="mt-3 h-12 rounded-xl items-center justify-center flex-row gap-2"
            style={{ backgroundColor: isPublic ? '#1E7A3A' : 'rgba(255,255,255,0.08)' }}
          >
            <Text style={{ fontSize: 16 }}>🔗</Text>
            <Text className="text-white font-bold">Partager ma carte</Text>
          </Pressable>
        </View>

        <View className="mt-6">
          <Button label="Enregistrer ma fiche" loading={loading} onPress={handleSave} />
        </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}
