import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppHeader } from '../../components/ui/app-header';
import { ScreenBackground } from '../../components/ui/screen-background';
import { apiClient } from '../../lib/api';
import { imageThumb } from '../../lib/image';
import { formatFcfa } from '../../types/terrain';
import { PendingReservationCart, useReservationCartStore } from '../../store/reservation-cart.store';
import { RemoteImageBackground } from '../../components/ui/remote-image';

const HOLD_DURATION_MS = 15 * 60 * 1000;
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date à confirmer'
    : `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function time(value: number): string {
  const hour = Math.floor(value);
  return `${String(hour).padStart(2, '0')}h${value % 1 === 0.5 ? '30' : '00'}`;
}

function timeRemaining(createdAt: string, now: number): string {
  const remaining = Math.max(0, HOLD_DURATION_MS - (now - new Date(createdAt).getTime()));
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function ReservationCartScreen() {
  const router = useRouter();
  const pendingReservation = useReservationCartStore((state) => state.pendingReservation);
  const setPendingReservation = useReservationCartStore((state) => state.setPendingReservation);
  const clearPendingReservation = useReservationCartStore((state) => state.clearPendingReservation);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadCart = useCallback(async () => {
    try {
      const { data } = await apiClient.get<PendingReservationCart | null>('/api/v1/reservations/mine/pending');
      setPendingReservation(data);
    } catch {
      // On garde l'éventuel état local pendant qu'un problème réseau temporaire
      // se résout ; aucune action de paiement n'est permise sans API.
    } finally {
      setLoading(false);
    }
  }, [setPendingReservation]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCart();
      return undefined;
    }, [loadCart]),
  );

  useEffect(() => {
    if (!pendingReservation) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [pendingReservation]);

  const expired = pendingReservation
    ? new Date(pendingReservation.created_at).getTime() + HOLD_DURATION_MS <= now
    : false;

  useEffect(() => {
    if (expired) void loadCart();
  }, [expired, loadCart]);

  async function cancelReservation(afterCancel?: () => void) {
    if (!pendingReservation || acting) return;
    try {
      setActing(true);
      await apiClient.patch(`/api/v1/reservations/mine/${pendingReservation.id}/cancel`);
      clearPendingReservation();
      afterCancel?.();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'Impossible d’annuler la réservation. Réessaie.';
      Alert.alert('Annulation impossible', message);
    } finally {
      setActing(false);
    }
  }

  function confirmCancel() {
    Alert.alert(
      'Annuler la réservation ?',
      'Le créneau sera immédiatement libéré pour les autres joueurs.',
      [
        { text: 'Conserver', style: 'cancel' },
        { text: 'Annuler le créneau', style: 'destructive', onPress: () => { void cancelReservation(); } },
      ],
    );
  }

  function confirmEdit() {
    if (!pendingReservation) return;
    Alert.alert(
      'Modifier le créneau ?',
      'Le créneau actuel sera libéré. Tu pourras ensuite en choisir un autre.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Modifier',
          onPress: () => {
            const terrainId = pendingReservation.terrain_id;
            void cancelReservation(() => router.push(`/terrain/${terrainId}/creneau`));
          },
        },
      ],
    );
  }

  async function checkout() {
    if (!pendingReservation || acting || expired) return;
    try {
      setActing(true);
      const { data } = await apiClient.post<{ reservation_id: string; status: 'accepted'; simulation: true }>(
        `/api/v1/payments/reservations/${pendingReservation.id}/checkout`,
      );
      clearPendingReservation();
      router.replace({
        pathname: '/terrain/[id]/confirmation',
        params: {
          id: pendingReservation.terrain_id,
          reservationId: data.reservation_id,
          date: pendingReservation.reservation_date,
          start: String(pendingReservation.start_hour),
          total: String(pendingReservation.total_price),
        },
      });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'La validation a échoué. Réessaie.';
      Alert.alert('Validation impossible', message);
      await loadCart();
    } finally {
      setActing(false);
    }
  }

  const photo = imageThumb(pendingReservation?.terrain?.photos?.[0], 700);

  return (
    <ScreenBackground>
      <AppHeader title="Mon panier" showLogo={false} centered />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 42, gap: 16 }}>
        {loading ? <ActivityIndicator color="#F7921E" /> : null}

        {!loading && !pendingReservation ? (
          <View className="rounded-card p-7 items-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ fontSize: 42 }}>🛒</Text>
            <Text className="text-white text-lg font-black mt-3">Ton panier est vide</Text>
            <Text className="text-white/60 text-center mt-2 leading-5">Choisis un terrain puis un créneau pour démarrer ta réservation.</Text>
            <Pressable onPress={() => router.push('/terrain')} className="mt-5 h-12 px-5 rounded-btn items-center justify-center" style={{ backgroundColor: '#F7921E' }}>
              <Text className="text-white font-bold">Voir les terrains</Text>
            </Pressable>
          </View>
        ) : null}

        {pendingReservation ? (
          <>
            <View className="rounded-card overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              {photo ? (
                <RemoteImageBackground uri={photo} contentFit="cover" style={{ height: 150 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(13,31,13,0.28)' }} />
                </RemoteImageBackground>
              ) : null}
              <View className="p-5">
                <Text className="text-white text-xl font-black">{pendingReservation.terrain?.name ?? 'Terrain'}</Text>
                <Text className="text-white/60 text-sm mt-1">📍 {pendingReservation.terrain?.city ?? 'Abidjan'}</Text>

                <View className="h-px my-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <CartRow label="Date" value={formatDate(pendingReservation.reservation_date)} />
                <CartRow label="Créneau" value={`${time(pendingReservation.start_hour)} – ${time(pendingReservation.end_hour)}`} />
                <CartRow label="Durée" value={`${pendingReservation.duration_hours % 1 === 0 ? pendingReservation.duration_hours : pendingReservation.duration_hours.toFixed(1).replace('.', ',')} h`} />
                <View className="h-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <CartRow label="Total" value={formatFcfa(pendingReservation.total_price)} accent />
              </View>
            </View>

            <View className="rounded-card p-4 flex-row items-center gap-3" style={{ backgroundColor: expired ? 'rgba(248,113,113,0.1)' : 'rgba(247,146,30,0.1)', borderWidth: 1, borderColor: expired ? 'rgba(248,113,113,0.55)' : 'rgba(247,146,30,0.5)' }}>
              <Text style={{ fontSize: 24 }}>{expired ? '⌛' : '⏱️'}</Text>
              <View className="flex-1">
                <Text className="text-white font-bold">{expired ? 'Créneau expiré' : `Créneau réservé : ${timeRemaining(pendingReservation.created_at, now)}`}</Text>
                <Text className="text-white/60 text-sm mt-0.5">{expired ? 'Actualisation du panier en cours…' : 'Valide ta réservation avant la fin du délai.'}</Text>
              </View>
            </View>

            <Pressable onPress={confirmEdit} disabled={acting || expired} className="h-13 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.65)', opacity: acting || expired ? 0.55 : 1 }}>
              <Text style={{ color: '#4ADE80' }} className="font-bold">Modifier le créneau</Text>
            </Pressable>
            <Pressable onPress={confirmCancel} disabled={acting} className="h-13 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(248,113,113,0.65)', opacity: acting ? 0.55 : 1 }}>
              <Text style={{ color: '#F87171' }} className="font-bold">Annuler la réservation</Text>
            </Pressable>
            <Pressable onPress={checkout} disabled={acting || expired} className="h-14 rounded-btn items-center justify-center" style={{ backgroundColor: '#F7921E', opacity: acting || expired ? 0.55 : 1 }}>
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold text-base">Valider la réservation</Text>}
            </Pressable>
            <Text className="text-white/45 text-center text-xs leading-5">Paiement simulé activé : les moyens Mobile Money seront disponibles prochainement.</Text>
          </>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

function CartRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5 gap-4">
      <Text className="text-white/55 text-base">{label}</Text>
      <Text className="font-bold text-base text-right" style={{ color: accent ? '#F7921E' : '#FFFFFF' }}>{value}</Text>
    </View>
  );
}
