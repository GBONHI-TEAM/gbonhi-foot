import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppHeader } from '../../components/ui/app-header';
import { ScreenBackground } from '../../components/ui/screen-background';
import { apiClient } from '../../lib/api';
import { formatFcfa } from '../../types/terrain';
import { timeRemaining, isReservationExpired } from '../../lib/cart-format';

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return globalThis.btoa(binary);
}

interface ReservationDetail {
  id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  duration_hours: number;
  total_price: number;
  status: string;
  created_at: string;
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
  const [downloading, setDownloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    apiClient.get<ReservationDetail>(`/api/v1/reservations/mine/${id}`)
      .then((response) => setReservation(response.data))
      .catch(() => setReservation(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Compte à rebours du délai de validation (uniquement utile pour un pending).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const isPending = reservation?.status === 'pending';
  const expired = reservation ? isReservationExpired(reservation.created_at, now) : false;

  // Le reçu n'est disponible que si le paiement est validé.
  const receiptAvailable = !!reservation
    && ['confirmed', 'completed'].includes(reservation.status)
    && reservation.payment?.status === 'accepted';

  async function downloadReceipt() {
    if (!reservation || !receiptAvailable) return;
    try {
      setDownloading(true);
      const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      const response = await apiClient.get<ArrayBuffer>(`/api/v1/payments/reservations/${reservation.id}/receipt.pdf`, { responseType: 'arraybuffer' });
      if (!FileSystem.documentDirectory) throw new Error('Dossier de téléchargement indisponible');
      const uri = `${FileSystem.documentDirectory}gbonhi-foot-recu-${reservation.id}.pdf`;
      await FileSystem.writeAsStringAsync(uri, toBase64(response.data), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Reçu GBONHI FOOT' });
      } else {
        Alert.alert('Reçu téléchargé', `Le reçu a été enregistré dans : ${uri}`);
      }
    } catch {
      Alert.alert('Téléchargement impossible', 'Réessaie dans quelques instants.');
    } finally {
      setDownloading(false);
    }
  }

  // Libère le créneau (annulation du panier) puis exécute l'action suivante.
  async function releaseHold(afterRelease?: () => void) {
    if (!reservation || busy) return;
    try {
      setBusy(true);
      await apiClient.patch(`/api/v1/reservations/mine/${reservation.id}/cancel`);
      (afterRelease ?? (() => router.back()))();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action impossible. Réessaie.';
      Alert.alert('Action impossible', message);
    } finally {
      setBusy(false);
    }
  }

  function onValider() {
    if (!reservation) return;
    router.push(`/cart/${reservation.id}` as Href);
  }

  function onModifier() {
    if (!reservation) return;
    Alert.alert('Modifier le créneau ?', 'Le créneau actuel sera libéré. Tu pourras en choisir un autre.', [
      { text: 'Retour', style: 'cancel' },
      { text: 'Modifier', onPress: () => { void releaseHold(() => router.replace(`/terrain/${reservation.terrain.id}/creneau` as Href)); } },
    ]);
  }

  function onSupprimer() {
    Alert.alert('Retirer du panier ?', 'Le créneau sera immédiatement libéré pour les autres joueurs.', [
      { text: 'Conserver', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => { void releaseHold(); } },
    ]);
  }

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
  const showCartActions = isPending && !expired;
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

        {/* Réservation en attente : délai + actions de validation (comme le panier). */}
        {isPending ? (
          <View className="rounded-btn p-3 flex-row items-center gap-3 mt-4" style={{ backgroundColor: expired ? 'rgba(248,113,113,0.1)' : 'rgba(247,146,30,0.1)', borderWidth: 1, borderColor: expired ? 'rgba(248,113,113,0.55)' : 'rgba(247,146,30,0.5)' }}>
            <Text style={{ fontSize: 20 }}>{expired ? '⌛' : '⏱️'}</Text>
            <View className="flex-1">
              <Text className="text-white font-bold text-sm">{expired ? 'Délai de validation expiré' : `Créneau réservé : ${timeRemaining(reservation.created_at, now)}`}</Text>
              <Text className="text-white/60 text-xs mt-0.5">{expired ? 'Ce créneau a été libéré faute de paiement à temps.' : 'Valide avant la fin du délai pour confirmer.'}</Text>
            </View>
          </View>
        ) : null}

        {showCartActions ? (
          <>
            {/* Valider en premier (mis en valeur) → espace de paiement */}
            <Pressable onPress={onValider} disabled={busy} className="h-14 rounded-btn items-center justify-center mt-4" style={{ backgroundColor: '#F7921E', opacity: busy ? 0.6 : 1 }}>
              <Text className="text-white font-black text-base">Valider la réservation</Text>
            </Pressable>
            {/* Puis Modifier + Supprimer */}
            <View className="flex-row gap-2.5 mt-2.5">
              <Pressable onPress={onModifier} disabled={busy} className="flex-1 h-12 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.65)', opacity: busy ? 0.5 : 1 }}>
                <Text style={{ color: '#4ADE80' }} className="font-bold text-sm">Modifier</Text>
              </Pressable>
              <Pressable onPress={onSupprimer} disabled={busy} className="flex-1 h-12 rounded-btn items-center justify-center flex-row gap-1.5" style={{ borderWidth: 1, borderColor: 'rgba(248,113,113,0.65)', opacity: busy ? 0.5 : 1 }}>
                <Text style={{ fontSize: 14 }}>🗑️</Text>
                <Text style={{ color: '#F87171' }} className="font-bold text-sm">Supprimer</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {receiptAvailable ? (
          <Pressable onPress={downloadReceipt} disabled={downloading} className="rounded-2xl py-4 mt-5 flex-row items-center justify-center gap-2" style={{ backgroundColor: '#F7921E', opacity: downloading ? 0.6 : 1 }}>
            {downloading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={{ fontSize: 16 }}>📥</Text><Text className="text-white font-bold text-base">Télécharger / partager le reçu</Text></>}
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push(`/terrain/${reservation.terrain.id}` as Href)} className="rounded-2xl py-4 mt-3 items-center" style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.65)' }}>
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
