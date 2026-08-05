import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '../../components/ui/app-header';
import { ScreenBackground } from '../../components/ui/screen-background';
import { apiClient } from '../../lib/api';
import { formatFcfa } from '../../types/terrain';

interface ReservationDetail {
  id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  duration_hours: number;
  total_price: number;
  status: string;
  terrain: { id: string; name: string; address: string; city: string; surface: string };
  payment: { status: string; payment_method?: string | null } | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente de paiement', color: '#F7921E' },
  confirmed: { label: 'Confirmée', color: '#4ADE80' },
  completed: { label: 'Terminée', color: '#4ADE80' },
  cancelled: { label: 'Annulée', color: '#F87171' },
};

function time(value: number) {
  const hour = Math.floor(value);
  return `${String(hour).padStart(2, '0')}:${String(Math.round((value - hour) * 60)).padStart(2, '0')}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function ReservationDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<ReservationDetail>(`/api/v1/reservations/mine/${id}`)
      .then((response) => setReservation(response.data))
      .catch(() => setReservation(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0D1F0D' }}><ActivityIndicator color="#F7921E" size="large" /></View>;
  }

  if (!reservation) {
    return (
      <ScreenBackground>
        <AppHeader title="Réservation" centered onBack={() => router.back()} showLogo={false} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white/65 text-center">Cette réservation est introuvable.</Text>
        </View>
      </ScreenBackground>
    );
  }

  const status = STATUS[reservation.status] ?? { label: reservation.status, color: '#FFFFFF' };
  return (
    <ScreenBackground>
      <AppHeader title="Détail réservation" centered onBack={() => router.back()} showLogo={false} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 44 }}>
        <View className="rounded-3xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-white font-black text-xl">{reservation.terrain.name}</Text>
              <Text className="text-white/55 text-sm mt-1">📍 {reservation.terrain.address}, {reservation.terrain.city}</Text>
            </View>
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${status.color}22` }}>
              <Text className="text-xs font-bold" style={{ color: status.color }}>{status.label}</Text>
            </View>
          </View>

          <View className="mt-6 gap-4">
            <DetailRow label="Date" value={formatDate(reservation.reservation_date)} />
            <DetailRow label="Créneau" value={`${time(reservation.start_hour)} – ${time(reservation.end_hour)}`} />
            <DetailRow label="Durée" value={`${reservation.duration_hours % 1 === 0 ? reservation.duration_hours : reservation.duration_hours.toFixed(1).replace('.', ',')} h`} />
            <DetailRow label="Montant" value={formatFcfa(reservation.total_price)} accent />
          </View>
        </View>

        <Pressable onPress={() => router.push(`/terrain/${reservation.terrain.id}`)} className="rounded-2xl py-4 mt-5 items-center" style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.65)' }}>
          <Text className="font-bold" style={{ color: '#4ADE80' }}>Voir le terrain</Text>
        </Pressable>
      </ScrollView>
    </ScreenBackground>
  );
}

function DetailRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-white/55 text-sm">{label}</Text>
      <Text className="font-bold text-right" style={{ color: accent ? '#F7921E' : '#FFFFFF' }}>{value}</Text>
    </View>
  );
}
