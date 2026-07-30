import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, ImageBackground, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { apiClient } from '../../../lib/api';
import {
  type TerrainDetail,
  type Reservation,
  SURFACE_LABELS,
  formatFcfa,
} from '../../../types/terrain';

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];

type PayKey = 'wave' | 'orange' | 'mtn' | 'card';
const PAYMENT_METHODS: { key: PayKey; label: string; sub: string; logo?: unknown; emoji?: string }[] = [
  { key: 'wave', label: 'Wave', sub: 'Paiement mobile', logo: require('../../../../assets/images/pay-wave.png') },
  { key: 'orange', label: 'Orange Money', sub: 'Paiement mobile', logo: require('../../../../assets/images/pay-orange.webp') },
  { key: 'mtn', label: 'MTN MoMo', sub: 'Paiement mobile', logo: require('../../../../assets/images/pay-mtn.png') },
  { key: 'card', label: 'Carte bancaire', sub: 'Visa · Mastercard', emoji: '💳' },
];
const PAY_LABEL: Record<PayKey, string> = { wave: 'Wave', orange: 'Orange Money', mtn: 'MTN MoMo', card: 'Carte bancaire' };

function formatFullDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}
function hh(h: number): string {
  return `${String(h).padStart(2, '0')}h00`;
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
  const [payMethod, setPayMethod] = useState<PayKey>('wave');

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

  const total = terrain ? terrain.price_per_hour * durationHours : 0;

  async function onConfirm() {
    if (submitting) return;
    try {
      setSubmitting(true);
      const { data } = await apiClient.post<Reservation>('/api/v1/reservations', {
        terrain_id: id,
        reservation_date: date,
        start_hour: startHour,
        end_hour: endHour,
        notes: `Paiement : ${PAY_LABEL[payMethod]}`,
      });
      router.replace({
        pathname: '/terrain/[id]/confirmation',
        params: {
          id: String(id),
          reservationId: data.id,
          date,
          start: String(startHour),
          total: String(data.total_price ?? total),
        },
      });
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'La réservation a échoué. Réessaie.';
      Alert.alert('Erreur', message);
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
      {/* Header */}
      <View className="px-5 pt-14 pb-4" style={{ backgroundColor: '#1E7A3A' }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-white text-2xl">‹</Text>
          </Pressable>
          <Text className="text-white font-black text-xl flex-1 text-center mr-6">Récapitulatif</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Carte terrain */}
        <View
          className="rounded-card overflow-hidden flex-row mb-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {photo ? (
            <ImageBackground source={{ uri: photo }} resizeMode="cover" style={{ width: 100, height: 100 }} />
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
            { label: 'Durée', value: `${durationHours} heure${durationHours > 1 ? 's' : ''}` },
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

        {/* Mode de paiement */}
        <Text className="text-white font-black text-lg mb-3">Mode de paiement</Text>
        {PAYMENT_METHODS.map((m) => {
          const active = payMethod === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setPayMethod(m.key)}
              className="flex-row items-center gap-3 rounded-card p-3.5 mb-3"
              style={{
                backgroundColor: active ? 'rgba(30,122,58,0.12)' : 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: active ? '#2E9E4F' : 'rgba(255,255,255,0.1)',
              }}
            >
              <View className="w-12 h-12 rounded-xl items-center justify-center overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                {m.logo ? (
                  <Image source={m.logo as number} resizeMode="contain" style={{ width: 40, height: 40 }} />
                ) : (
                  <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">{m.label}</Text>
                <Text className="text-white/50 text-sm mt-0.5">{m.sub}</Text>
              </View>
              {/* Radio */}
              <View className="w-6 h-6 rounded-full items-center justify-center" style={{ borderWidth: 2, borderColor: active ? '#2E9E4F' : 'rgba(255,255,255,0.3)' }}>
                {active ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#2E9E4F' }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* CTA */}
      <View className="px-5 pt-3 pb-8" style={{ backgroundColor: '#0D1F0D' }}>
        <Pressable
          onPress={onConfirm}
          disabled={submitting}
          className="h-14 rounded-btn items-center justify-center"
          style={{ backgroundColor: '#F7921E', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Payer {formatFcfa(total)}</Text>
          )}
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
