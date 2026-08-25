import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, ImageBackground, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { AppHeader } from '../../../components/ui/app-header';
import { apiClient } from '../../../lib/api';
import { PendingReservationCart } from '../../../store/reservation-cart.store';
import { RemoteImageBackground } from '../../../components/ui/remote-image';
import {
  type TerrainDetail,
  SURFACE_LABELS,
  formatFcfa,
} from '../../../types/terrain';

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function formatFullDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}
function hh(h: number): string {
  return `${String(Math.floor(h)).padStart(2, '0')}h${h % 1 === 0.5 ? '30' : '00'}`;
}

function formatDuration(hours: number): string {
  const wholeHours = Math.floor(hours);
  return hours % 1 === 0.5 ? `${wholeHours} h 30` : `${wholeHours} h`;
}

export default function RecapPage() {
  const { id, date, start, end, duration } = useLocalSearchParams<{
    id: string;
    date: string;
    start: string;
    end: string;
    duration: string;
  }>();
  const router = useRouter();

  const startHour = Number(start);
  const endHour = Number(end);
  const durationHours = Number(duration);

  const [terrain, setTerrain] = useState<TerrainDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await apiClient.get<TerrainDetail>(`/api/v1/terrains/${id}`);
        if (mounted) setTerrain(data);
      } catch {
        if (mounted) setTerrain(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const total = terrain ? Math.round(terrain.price_per_hour * durationHours) : 0;

  async function onAddToCart() {
    if (submitting) return;
    try {
      setSubmitting(true);
      await apiClient.post<PendingReservationCart>('/api/v1/reservations', {
        terrain_id: id,
        reservation_date: date,
        start_hour: startHour,
        end_hour: endHour,
      });
      // Le panier recharge la liste complète des réservations en attente.
      router.replace('/(tabs)/cart');
    } catch (e: unknown) {
      const error = e as { response?: { status?: number; data?: { message?: string } } };
      const message = error.response?.data?.message ?? 'La réservation a échoué. Réessaie.';
      // 409 = ce créneau précis est déjà pris → on informe simplement.
      Alert.alert('Créneau indisponible', message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0D1F0D' }}>
        <ActivityIndicator color="#F7921E" size="large" />
      </View>
    );
  }

  const photo = terrain?.photos?.[0];

  return (
    <ScreenBackground>
      <AppHeader title="Récapitulatif" onBack={() => router.back()} showLogo={false} centered />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Carte terrain */}
        <View
          className="rounded-card overflow-hidden flex-row mb-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {photo ? (
            <RemoteImageBackground uri={photo} contentFit="cover" style={{ width: 100, height: 100 }} />
          ) : (
            <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F3D1E' }}>
              <Text style={{ fontSize: 30, opacity: 0.5 }}>🏟️</Text>
            </View>
          )}
          <View className="flex-1 p-3 justify-center">
            <Text className="text-white font-black text-lg">{terrain?.name ?? 'Terrain'}</Text>
            <Text className="text-white/55 text-sm mt-0.5">
              📍 {terrain?.city}
              {terrain ? ` · ${SURFACE_LABELS[terrain.surface]}` : ''}
            </Text>
            {terrain ? (
              <View className="flex-row items-center gap-1 mt-1">
                <Text style={{ color: '#FFB830' }}>★</Text>
                <Text style={{ color: '#2E9E4F' }} className="font-bold text-sm">{terrain.rating_avg.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Détails */}
        <View
          className="rounded-card p-4 mb-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {[
            { label: 'Date', value: formatFullDate(date) },
            { label: 'Horaire', value: `${hh(startHour)} → ${hh(endHour)}` },
            { label: 'Durée', value: formatDuration(durationHours) },
          ].map((row) => (
            <View key={row.label} className="flex-row items-center justify-between py-2">
              <Text className="text-white/55 text-base">{row.label}</Text>
              <Text className="text-white font-bold text-base">{row.value}</Text>
            </View>
          ))}
          <View className="h-px my-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-white font-bold text-lg">Total</Text>
            <Text className="text-accent font-black text-xl">{formatFcfa(total)}</Text>
          </View>
        </View>

        <Text className="text-white font-black text-lg mb-3">Ton panier</Text>
        <View
          className="flex-row items-center gap-3 rounded-card p-4"
          style={{ backgroundColor: 'rgba(30,122,58,0.12)', borderWidth: 1, borderColor: '#2E9E4F' }}
        >
          <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
            <Text className="text-white text-2xl">✓</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-base">Créneau bloqué pendant 15 minutes</Text>
            <Text className="text-white/60 text-sm mt-0.5">Tu pourras le valider depuis ton panier.</Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View className="px-5 pt-3 pb-8" style={{ backgroundColor: '#0D1F0D' }}>
        <Pressable
          onPress={onAddToCart}
          disabled={submitting}
          className="h-14 rounded-btn items-center justify-center"
          style={{ backgroundColor: '#F7921E', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Ajouter au panier</Text>
          )}
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
