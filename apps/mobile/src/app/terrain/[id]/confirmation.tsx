import { useEffect, useState } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../../lib/api';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { type TerrainDetail, formatFcfa } from '../../../types/terrain';

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}
function hh(h: number): string {
  return `${String(h).padStart(2, '0')}h00`;
}
function refNumber(reservationId: string): string {
  const tail = reservationId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0000';
  return `#GB-${new Date().getFullYear()}-${tail}`;
}

export default function ConfirmationPage() {
  const { id, reservationId, date, start, total } = useLocalSearchParams<{
    id: string;
    reservationId: string;
    date: string;
    start: string;
    total: string;
  }>();
  const router = useRouter();
  const [terrainName, setTerrainName] = useState<string>('ton terrain');
  const ref = refNumber(reservationId ?? '');

  async function shareReceipt() {
    const lines = [
      'GBONHI FOOT — Reçu de réservation',
      `N° ${ref}`,
      `Terrain : ${terrainName}`,
      `Date : ${formatShortDate(date)} · ${hh(Number(start))}`,
      `Montant : ${formatFcfa(Number(total))}`,
      'Statut : Enregistrée (en attente de confirmation)',
    ];
    await Share.share({ message: lines.join('\n') });
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await apiClient.get<TerrainDetail>(`/api/v1/terrains/${id}`);
        if (mounted && data?.name) setTerrainName(data.name);
      } catch {
        /* nom par défaut */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <ScreenBackground>

      <View className="flex-1 items-center justify-center px-8">
        {/* Check */}
        <View
          className="w-28 h-28 rounded-full items-center justify-center mb-8"
          style={{ backgroundColor: '#2E9E4F' }}
        >
          <Text className="text-white" style={{ fontSize: 56 }}>✓</Text>
        </View>

        <Text className="text-white font-black text-3xl text-center">Réservation confirmée !</Text>
        <Text className="text-white/65 text-base text-center mt-3 leading-relaxed">
          Ta réservation à <Text className="text-white font-bold">{terrainName}</Text> est bien enregistrée.
        </Text>

        {/* Récap */}
        <View
          className="w-full rounded-card p-4 mt-8"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <View className="flex-row items-center justify-between pb-3">
            <Text className="text-white/55 text-sm">N° de réservation</Text>
            <Text className="text-accent font-black text-base">{ref}</Text>
          </View>
          <View className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View className="flex-row items-center justify-between pt-3">
            <Text className="text-white/55 text-sm">
              {formatShortDate(date)} · {hh(Number(start))}
            </Text>
            <Text className="text-white font-bold text-base">{formatFcfa(Number(total))}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View className="px-8 pb-10">
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          className="h-14 rounded-btn items-center justify-center"
          style={{ backgroundColor: '#F7921E' }}
        >
          <Text className="text-white font-bold text-base">Retour à l&apos;accueil</Text>
        </Pressable>

        <Pressable
          onPress={shareReceipt}
          className="h-14 rounded-btn flex-row items-center justify-center gap-2 mt-3 active:opacity-80"
          style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}
        >
          <Text style={{ fontSize: 16 }}>📩</Text>
          <Text className="text-white font-semibold text-base">Télécharger le reçu</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/(tabs)')} className="h-11 items-center justify-center mt-3 active:opacity-70">
          <Text className="text-white/70 text-sm font-semibold">Voir ma réservation</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
