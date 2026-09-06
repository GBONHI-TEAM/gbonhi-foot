import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AppHeader } from '../../components/ui/app-header';
import { ScreenBackground } from '../../components/ui/screen-background';
import { apiClient } from '../../lib/api';
import { formatFcfa } from '../../types/terrain';
import { PendingReservationCart, useReservationCartStore } from '../../store/reservation-cart.store';
import { formatDate, time, timeRemaining, isReservationExpired } from '../../lib/cart-format';

export default function ReservationCartScreen() {
  const router = useRouter();
  const pendingReservations = useReservationCartStore((state) => state.pendingReservations);
  const setPendingReservations = useReservationCartStore((state) => state.setPendingReservations);
  const removePendingReservation = useReservationCartStore((state) => state.removePendingReservation);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadCart = useCallback(async () => {
    try {
      const { data } = await apiClient.get<PendingReservationCart[]>('/api/v1/reservations/mine/cart');
      setPendingReservations(Array.isArray(data) ? data : []);
    } catch {
      // On garde l'éventuel état local pendant qu'un problème réseau temporaire se résout.
    } finally {
      setLoading(false);
    }
  }, [setPendingReservations]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCart();
      return undefined;
    }, [loadCart]),
  );

  useEffect(() => {
    if (pendingReservations.length === 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [pendingReservations.length]);

  const isExpired = useCallback((r: PendingReservationCart) => isReservationExpired(r.created_at, now), [now]);

  // Dès qu'une réservation expire, on recharge le panier (le backend l'a libérée).
  const hasExpired = pendingReservations.some(isExpired);
  useEffect(() => {
    if (hasExpired) void loadCart();
  }, [hasExpired, loadCart]);

  async function removeFromCart(id: string, afterRemove?: () => void) {
    if (actingId) return;
    try {
      setActingId(id);
      await apiClient.patch(`/api/v1/reservations/mine/${id}/cancel`);
      removePendingReservation(id);
      afterRemove?.();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'Impossible de retirer la réservation du panier. Réessaie.';
      Alert.alert('Action impossible', message);
    } finally {
      setActingId(null);
    }
  }

  function confirmRemove(id: string) {
    Alert.alert(
      'Retirer du panier ?',
      'Le créneau sera immédiatement libéré pour les autres joueurs.',
      [
        { text: 'Conserver', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => { void removeFromCart(id); } },
      ],
    );
  }

  function confirmEdit(reservation: PendingReservationCart) {
    Alert.alert(
      'Modifier le créneau ?',
      'Le créneau actuel sera libéré. Tu pourras ensuite en choisir un autre.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Modifier',
          onPress: () => { void removeFromCart(reservation.id, () => router.push(`/terrain/${reservation.terrain_id}/creneau`)); },
        },
      ],
    );
  }

  const empty = !loading && pendingReservations.length === 0;

  return (
    <ScreenBackground>
      <AppHeader
        title="Mon panier"
        showLogo={false}
        centered
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 42, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void loadCart().finally(() => setRefreshing(false)); }}
            tintColor="#F7921E"
          />
        }
      >
        {loading ? <ActivityIndicator color="#F7921E" /> : null}

        {empty ? (
          <View className="rounded-card p-7 items-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ fontSize: 42 }}>🛒</Text>
            <Text className="text-white text-lg font-black mt-3">Ton panier est vide</Text>
            <Text className="text-white/60 text-center mt-2 leading-5">Choisis un terrain puis un créneau pour démarrer ta réservation.</Text>
            <Pressable onPress={() => router.push('/terrain')} className="mt-5 h-12 px-5 rounded-btn items-center justify-center" style={{ backgroundColor: '#F7921E' }}>
              <Text className="text-white font-bold">Voir les terrains</Text>
            </Pressable>
          </View>
        ) : null}

        {pendingReservations.length > 0 ? (
          <>
            <Text className="text-white/70 text-sm mb-1">
              {pendingReservations.length} réservation{pendingReservations.length > 1 ? 's' : ''} en attente · valide celles que tu souhaites.
            </Text>

            {/* Blocs compacts : au moins 2 visibles sans scroller */}
            {pendingReservations.map((reservation) => {
              const expired = isExpired(reservation);
              const anyBusy = actingId !== null;
              const dur = reservation.duration_hours % 1 === 0 ? reservation.duration_hours : reservation.duration_hours.toFixed(1).replace('.', ',');
              return (
                <View key={reservation.id} className="rounded-card p-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white text-base font-black" numberOfLines={1}>{reservation.terrain?.name ?? 'Terrain'}</Text>
                      <Text className="text-white/55 text-xs mt-0.5" numberOfLines={1}>
                        {formatDate(reservation.reservation_date)} · {time(reservation.start_hour)}–{time(reservation.end_hour)} · {dur} h
                      </Text>
                    </View>
                    <Text className="font-black text-base" style={{ color: '#F7921E' }}>{formatFcfa(reservation.total_price)}</Text>
                  </View>

                  {/* Minuteur compact */}
                  <Text className="text-xs mt-2" style={{ color: expired ? '#F87171' : 'rgba(255,255,255,0.6)' }}>
                    {expired ? '⌛ Créneau expiré — actualisation…' : `⏱️ Créneau réservé : ${timeRemaining(reservation.created_at, now)} · valide avant la fin du délai`}
                  </Text>

                  {/* Valider en premier (mis en valeur) */}
                  <Pressable
                    onPress={() => router.push(`/cart/${reservation.id}` as Href)}
                    disabled={anyBusy || expired}
                    className="h-12 rounded-btn items-center justify-center mt-3"
                    style={{ backgroundColor: '#F7921E', opacity: expired ? 0.5 : 1 }}
                  >
                    <Text className="text-white font-bold text-base">Valider la réservation</Text>
                  </Pressable>

                  {/* Puis Modifier + Supprimer du panier */}
                  <View className="flex-row gap-2.5 mt-2.5">
                    <Pressable onPress={() => confirmEdit(reservation)} disabled={anyBusy || expired} className="flex-1 h-11 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.65)', opacity: anyBusy || expired ? 0.5 : 1 }}>
                      <Text style={{ color: '#4ADE80' }} className="font-bold text-sm">Modifier</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmRemove(reservation.id)} disabled={anyBusy} className="flex-1 h-11 rounded-btn items-center justify-center flex-row gap-1.5" style={{ borderWidth: 1, borderColor: 'rgba(248,113,113,0.65)', opacity: anyBusy ? 0.5 : 1 }}>
                      <Text style={{ fontSize: 14 }}>🗑️</Text>
                      <Text style={{ color: '#F87171' }} className="font-bold text-sm">Supprimer</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}
