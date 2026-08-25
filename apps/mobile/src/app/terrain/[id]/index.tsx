import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ImageBackground,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { apiClient } from '../../../lib/api';
import { invalidateCached } from '../../../lib/api-cache';
import { imageThumb } from '../../../lib/image';
import { RemoteImageBackground } from '../../../components/ui/remote-image';
import {
  type TerrainDetail,
  type TerrainAvailability,
  SURFACE_LABELS,
  formatFcfa,
} from '../../../types/terrain';

const { width } = Dimensions.get('window');

// Sous-titre surface (maquette : « Gazon naturel »).
const SURFACE_SUBTITLE: Record<string, string> = {
  grass: 'Gazon naturel',
  artificial: 'Synthétique',
  futsal: 'Futsal',
};

// Icônes d'équipements (fallback : puce neutre).
const AMENITY_ICONS: Record<string, string> = {
  'Éclairage': '💡', 'Eclairage': '💡', 'Vestiaires': '🧦', 'Parking': '🅿️',
  'Buvette': '🍽️', 'Douches': '🚿', 'Wifi': '📶', 'WiFi': '📶', 'Tribunes': '🪑',
};

function openMaps(t: TerrainDetail) {
  const query =
    t.latitude != null && t.longitude != null
      ? `${t.latitude},${t.longitude}`
      : encodeURIComponent(`${t.name} ${t.address} ${t.city}`);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0);
  const items = photos.length > 0 ? photos : [null];

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {items.map((uri, i) =>
          uri ? (
            <RemoteImageBackground key={i} uri={imageThumb(uri, 900)} contentFit="cover" style={{ width, height: 300 }} />
          ) : (
            <View key={i} style={{ width, height: 300, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F3D1E' }}>
              <Text style={{ fontSize: 64, opacity: 0.5 }}>🏟️</Text>
            </View>
          ),
        )}
      </ScrollView>
      {items.length > 1 && (
        <View className="flex-row gap-1.5 justify-center" style={{ position: 'absolute', bottom: 16, left: 0, right: 0 }}>
          {items.map((_, i) => (
            <View key={i} style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.5)' }} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function TerrainDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [terrain, setTerrain] = useState<TerrainDetail | null>(null);
  const [availability, setAvailability] = useState<TerrainAvailability | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [terrainRes, availRes, favoritesRes] = await Promise.all([
          apiClient.get<TerrainDetail>(`/api/v1/terrains/${id}`),
          apiClient
            .get<TerrainAvailability>(`/api/v1/terrains/${id}/availability`, { params: { date: todayYmd() } })
            .catch(() => ({ data: null as TerrainAvailability | null })),
          apiClient.get<{ id: string }[]>('/api/v1/terrains/favorites').catch(() => ({ data: [] as { id: string }[] })),
        ]);
        if (!mounted) return;
        setTerrain(terrainRes.data);
        setAvailability(availRes.data ?? null);
        setIsFavorite(favoritesRes.data.some((favorite) => favorite.id === id));
      } catch (e: unknown) {
        const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
        const status = err?.response?.status;
        const detail = err?.response?.data?.message || err?.message || 'Erreur inconnue';
        console.log('[terrain detail] error', status, detail, 'id=', id);
        if (mounted) {
          setError(
            status === 503
              ? 'La base de données est momentanément inaccessible. Réessaie dans quelques secondes.'
              : status === 401
                ? 'Ta session a expiré. Reconnecte-toi puis réessaie.'
                : 'Impossible de charger ce terrain pour le moment.',
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, retryKey]);

  async function toggleFavorite() {
    if (favoriteLoading) return;
    try {
      setFavoriteLoading(true);
      if (isFavorite) {
        await apiClient.delete(`/api/v1/terrains/${id}/favorite`);
      } else {
        await apiClient.post(`/api/v1/terrains/${id}/favorite`);
      }
      setIsFavorite((value) => !value);
      // Invalide le cache pour que Profil › Favoris se mette à jour tout seul.
      invalidateCached('/api/v1/terrains/favorites');
      invalidateCached('/api/v1/users/me/summary');
    } finally {
      setFavoriteLoading(false);
    }
  }

  // Créneaux d'ouverture du jour, marqués disponibles / indisponibles.
  const todaySlots = useMemo(() => {
    if (!terrain?.slots) return [];
    const dow = (new Date().getDay() + 6) % 7; // 0 = lundi
    const hours = new Set<number>();
    for (const s of terrain.slots) {
      if (s.day_of_week !== dow) continue;
      for (let h = s.start_hour; h < s.end_hour; h++) hours.add(h);
    }
    const unavailable = new Set<number>([
      ...(availability?.booked ?? []),
      ...(availability?.pending ?? []),
      ...(availability?.blocked ?? []),
    ]);
    return Array.from(hours).sort((a, b) => a - b).map((h) => ({ hour: h, available: !unavailable.has(h) }));
  }, [terrain, availability]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0D1F0D' }}>
        <ActivityIndicator color="#F7921E" size="large" />
      </View>
    );
  }

  if (error || !terrain) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#0D1F0D' }}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text className="text-white/70 text-center text-sm mt-3">{error ?? 'Terrain introuvable.'}</Text>
        <Pressable onPress={() => setRetryKey((value) => value + 1)} className="mt-6 h-12 px-6 rounded-btn items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
          <Text className="text-white font-semibold">Réessayer</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-accent font-semibold">← Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Carrousel photos */}
        <View>
          <PhotoCarousel photos={terrain.photos ?? []} />
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/terrain'))}
            className="absolute w-10 h-10 rounded-full items-center justify-center"
            style={{ top: 52, left: 16, backgroundColor: 'rgba(0,0,0,0.5)' }}
            hitSlop={8}
          >
            <Text className="text-white text-xl">←</Text>
          </Pressable>
          <Pressable
            onPress={toggleFavorite}
            disabled={favoriteLoading}
            className="absolute w-10 h-10 rounded-full items-center justify-center"
            style={{ top: 52, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', opacity: favoriteLoading ? 0.6 : 1 }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Text style={{ fontSize: 20, color: isFavorite ? '#F7921E' : '#FFFFFF' }}>{isFavorite ? '♥' : '♡'}</Text>
          </Pressable>
        </View>

        <View className="px-5 pt-5">
          {/* Titre + note */}
          <View className="flex-row items-start justify-between gap-3">
            <Text className="text-white text-3xl font-black flex-1">{terrain.name}</Text>
            <View className="flex-row items-center gap-1 rounded-lg px-3 py-1.5" style={{ borderWidth: 1, borderColor: 'rgba(255,184,48,0.5)' }}>
              <Text style={{ color: '#FFB830', fontSize: 14 }}>★</Text>
              <Text style={{ color: '#FFB830' }} className="font-bold">{terrain.rating_avg.toFixed(1)}</Text>
            </View>
          </View>
          <Text className="text-white/55 text-base mt-1.5">📍 {terrain.address}, {terrain.city}</Text>

          {/* Description */}
          {terrain.description ? (
            <Text className="text-white/65 text-base leading-relaxed mt-4">{terrain.description}</Text>
          ) : null}

          {/* Localisation */}
          <Pressable
            onPress={() => openMaps(terrain)}
            className="h-14 rounded-btn flex-row items-center justify-center gap-2 mt-5 active:opacity-80"
            style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.6)' }}
          >
            <Text style={{ color: '#2E9E4F', fontSize: 16 }}>📍</Text>
            <Text style={{ color: '#2E9E4F' }} className="text-base font-bold">Voir la localisation</Text>
          </Pressable>

          {/* Équipements (chips, sans titre — conforme maquette) */}
          {terrain.amenities?.length > 0 && (
            <View className="flex-row flex-wrap gap-3 mt-4">
              {terrain.amenities.map((a) => (
                <View key={a} className="rounded-btn flex-row items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ fontSize: 14 }}>{AMENITY_ICONS[a] ?? '•'}</Text>
                  <Text className="text-white text-sm font-medium">{a}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tarif */}
          <View className="rounded-card p-4 mt-6 flex-row items-center justify-between" style={{ backgroundColor: 'rgba(247,146,30,0.08)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.35)' }}>
            <View>
              <Text className="text-white/50 text-sm">Tarif</Text>
              <Text className="text-accent text-2xl font-black mt-0.5">
                {formatFcfa(terrain.price_per_hour)} <Text className="text-white/50 text-base font-normal">/ heure</Text>
              </Text>
            </View>
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(46,158,79,0.2)' }}>
              <Text style={{ color: '#2E9E4F' }} className="text-sm font-semibold">{SURFACE_SUBTITLE[terrain.surface] ?? SURFACE_LABELS[terrain.surface]}</Text>
            </View>
          </View>

          {/* Créneaux disponibles aujourd'hui */}
          <Text className="text-white font-black text-lg mt-7 mb-3">Créneaux disponibles aujourd&apos;hui</Text>
          {todaySlots.length === 0 ? (
            <Text className="text-white/45 text-sm">
              Aucun créneau aujourd&apos;hui. Touche « Réserver » pour choisir une autre date.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {todaySlots.map((s) => (
                <Pressable
                  key={s.hour}
                  disabled={!s.available}
                  onPress={() => router.push(`/terrain/${id}/creneau`)}
                  className="rounded-btn items-center justify-center px-5 h-12"
                  style={{
                    borderWidth: 1,
                    borderColor: s.available ? 'rgba(46,158,79,0.6)' : 'rgba(255,255,255,0.12)',
                    backgroundColor: s.available ? 'rgba(46,158,79,0.1)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Text
                    className="font-bold text-base"
                    style={{ color: s.available ? '#4ADE80' : 'rgba(255,255,255,0.35)', textDecorationLine: s.available ? 'none' : 'line-through' }}
                  >
                    {String(s.hour).padStart(2, '0')}:00
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* CTA fixe */}
      <View className="absolute left-0 right-0 bottom-0 px-5 pt-3 pb-8" style={{ backgroundColor: '#0D1F0D' }}>
        <Pressable
          onPress={() => router.push(`/terrain/${id}/creneau`)}
          className="h-14 rounded-btn items-center justify-center active:opacity-90"
          style={{ backgroundColor: '#F7921E' }}
        >
          <Text className="text-white font-bold text-base">Réserver</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
