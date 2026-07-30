import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { MotifsBackground } from '../../components/ui/motifs-background';
import { useAuthStore } from '../../store/auth.store';
import { useUserModeStore } from '../../store/user-mode.store';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api';

const PIED_FORT = ['Droit', 'Gauche'];
const POSTES = ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'];
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
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');

  // Pré-remplir Prénom / Nom avec le VRAI nom du compte connecté (saisi à
  // l'inscription, stocké dans user_metadata.full_name). N'écrase pas une
  // saisie déjà faite par l'utilisateur.
  useEffect(() => {
    const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
    if (!fullName) return;
    const parts = fullName.split(/\s+/);
    setPrenom((p) => p || parts[0] || '');
    setNom((n) => n || parts.slice(1).join(' '));
  }, [user]);
  const [dateNaissance, setDateNaissance] = useState('');
  const [taille, setTaille] = useState('');
  const [poids, setPoids] = useState('');
  const [piedFort, setPiedFort] = useState('');
  const [poste, setPoste] = useState('');
  const [posteSecondaire, setPosteSecondaire] = useState('');
  const [niveau, setNiveau] = useState('');
  const [infos, setInfos] = useState('');
  const [loading, setLoading] = useState(false);

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
    });
    if (!result.canceled && result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
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
    });
    if (!result.canceled && result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
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
    if (!prenom || !nom || !dateNaissance || !taille || !poids || !piedFort || !poste || !niveau) {
      Alert.alert('Erreur', 'Tous les champs obligatoires (*) doivent être remplis');
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
      await apiClient.patch('/api/v1/users/me', { full_name: fullName, position: poste });
    } catch {
      // non bloquant
    }

    // 2b) Rafraîchir la session en mémoire pour que le flag soit vu immédiatement
    // (évite une redirection en boucle vers la fiche).
    const { data: sess } = await supabase.auth.getSession();
    useAuthStore.getState().setSession(sess.session);

    setLoading(false);
    // 3) Fiche créée → mode Ligue + accueil.
    setMode('leagues');
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary-deep"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Filigrane Variante B — motifs géométriques ivoiriens officiels */}
      <MotifsBackground opacity={0.5} />

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 56, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo centré avec halo doux */}
        <View className="items-center mb-3">
          <View
            className="w-14 h-14 rounded-full bg-primary items-center justify-center border-2 border-accent-gold"
            style={{
              shadowColor: '#FFB830',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <Text style={{ fontSize: 24 }}>⚽</Text>
          </View>
        </View>

        <Text className="text-white text-3xl font-black text-center mb-6">Ta fiche joueur</Text>

        {/* Photo de profil */}
        <Pressable onPress={pickPhoto} className="items-center mb-2">
          <View
            className="w-28 h-28 rounded-full border-2 border-dashed border-white/40 items-center justify-center overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 34 }}>📷</Text>
            )}
          </View>
          <Text className="text-white/70 text-sm mt-2">
            {photoUri ? 'Modifier la photo' : 'Ajouter une photo'} <Text className="text-accent">*</Text>
          </Text>
        </Pressable>

        {/* IDENTITÉ */}
        <SectionLabel>Identité</SectionLabel>
        <View className="gap-3">
          <Input placeholder="Prénom *" value={prenom} onChangeText={setPrenom} autoCapitalize="words" />
          <Input placeholder="Nom *" value={nom} onChangeText={setNom} autoCapitalize="words" />
          <Input
            placeholder="jj/mm/aaaa"
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

        <View className="mt-6">
          <Button label="Enregistrer ma fiche" loading={loading} onPress={handleSave} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
