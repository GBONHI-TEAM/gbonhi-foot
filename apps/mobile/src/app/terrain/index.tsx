import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  ImageBackground,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenBackground } from '../../components/ui/screen-background';
import { apiClient } from '../../lib/api';
import { imageThumb } from '../../lib/image';
import {
  type Terrain,
  type TerrainSurface,
  SURFACE_LABELS,
  formatFcfa,
} from '../../types/terrain';

type FilterKey = 'all' | 'grass' | 'artificial' | 'futsal' | 'fmt5' | 'fmt7';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'grass', label: 'Gazon' },
  { key: 'artificial', label: 'Synthétique' },
  { key: 'futsal', label: 'Futsal' },
  { key: 'fmt5', label: '5vs5' },
  { key: 'fmt7', label: '7vs7' },
];

// Couleur du badge « type » selon la surface (maquette s22).
const SURFACE_BADGE_BG: Record<TerrainSurface, string> = {
  grass: '#1E7A3A',
  artificial: '#F7921E',
  futsal: '#2563EB',
};
// Sous-titre « format · surface » (maquette : « 7vs7 · Gazon naturel »).
const SURFACE_SUBTITLE: Record<TerrainSurface, string> = {
  grass: 'Gazon naturel',
  artificial: 'Synthétique',
  futsal: 'Futsal',
};

function TerrainCard({ terrain }: { terrain: Terrain }) {
  const router = useRouter();
  const photo = imageThumb(terrain.photos?.[0], 700);

  return (
    <Pressable
      onPress={() => router.push(`/terrain/${terrain.id}`)}
      className="rounded-card overflow-hidden mb-4 active:opacity-90"
      style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {/* Image */}
      <View style={{ height: 175 }}>
        {photo ? (
          <Image source={{ uri: photo }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,61,30,0.9)' }}>
            <Text style={{ fontSize: 40, opacity: 0.5 }}>🏟️</Text>
          </View>
        )}

        {/* Badge type (haut-gauche) + note (haut-droite) */}
        <View className="flex-row items-start justify-between p-3">
          <View className="rounded-lg px-3 py-1" style={{ backgroundColor: SURFACE_BADGE_BG[terrain.surface] }}>
            <Text className="text-white text-xs font-bold">{SURFACE_LABELS[terrain.surface]}</Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-lg px-2 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <Text style={{ color: '#FFB830', fontSize: 12 }}>★</Text>
            <Text className="text-white text-xs font-bold">{terrain.rating_avg.toFixed(1)}</Text>
          </View>
        </View>

        {/* Badge disponibilité (bas-droite) */}
        <View style={{ position: 'absolute', right: 12, bottom: 12 }}>
          <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: '#1E7A3A' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
            <Text className="text-white text-xs font-bold">Disponible</Text>
          </View>
        </View>
      </View>

      {/* Corps */}
      <View className="p-4">
        <Text className="text-white text-xl font-black">{terrain.name}</Text>
        <Text className="text-white/60 text-sm mt-1.5">
          👥 {terrain.format} · {SURFACE_SUBTITLE[terrain.surface]}
        </Text>
        <Text className="text-white/50 text-sm mt-1">📍 {terrain.address}, {terrain.city}</Text>
        <Text className="text-accent text-lg font-black mt-3">
          {formatFcfa(terrain.price_per_hour)} <Text className="text-white/50 text-sm font-normal">/ heure</Text>
        </Text>
      </View>
    </Pressable>
  );
}

export default function TerrainListPage() {
  const router = useRouter();
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await apiClient.get<Terrain[]>('/api/v1/terrains');
        if (mounted) setTerrains(data ?? []);
      } catch {
        if (mounted) setError('Impossible de charger les terrains. Réessaie plus tard.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visible = useMemo(() => {
    return terrains.filter((t) => {
      const byFilter =
        filter === 'all'
          ? true
          : filter === 'fmt5'
            ? t.format?.includes('5')
            : filter === 'fmt7'
              ? t.format?.includes('7')
              : t.surface === filter;
      const q = search.trim().toLowerCase();
      const byQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q);
      return byFilter && byQuery;
    });
  }, [terrains, filter, search]);

  return (
    <ScreenBackground>
      {/* Header kente vert (maquette s22) */}
      <ImageBackground
        source={require('../../../assets/images/kente-green.png')}
        resizeMode="repeat"
        style={{ paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' }}
        imageStyle={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={8} style={{ width: 32 }}>
            <Text className="text-white text-2xl">‹</Text>
          </Pressable>
          <Text className="text-white font-black text-2xl flex-1 text-center" style={{ marginRight: 32 }}>Terrains</Text>
        </View>
        <View className="h-12 rounded-full flex-row items-center px-4 gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un terrain..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            className="flex-1 text-white text-base"
          />
        </View>
      </ImageBackground>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
        className="mt-4 flex-grow-0"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className="h-11 rounded-full items-center justify-center px-6"
              style={{
                backgroundColor: active ? '#1E7A3A' : 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: active ? '#1E7A3A' : 'rgba(255,255,255,0.15)',
              }}
            >
              <Text className="text-sm font-bold" style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Contenu */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F7921E" size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text className="text-white/70 text-center text-sm mt-3">{error}</Text>
        </View>
      ) : visible.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 44 }}>🏟️</Text>
          <Text className="text-white font-bold text-lg mt-4 text-center">Aucun terrain trouvé</Text>
          <Text className="text-white/50 text-sm mt-2 text-center">
            Essaie de modifier ta recherche ou tes filtres.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => <TerrainCard terrain={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenBackground>
  );
}
