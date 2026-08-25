import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Text, View, type ImageSourcePropType } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppHeader } from '../../components/ui/app-header';
import { ScreenBackground } from '../../components/ui/screen-background';
import { apiClient } from '../../lib/api';
import { imageThumb } from '../../lib/image';
import { formatFcfa } from '../../types/terrain';
import { PendingReservationCart, useReservationCartStore } from '../../store/reservation-cart.store';
import { RemoteImageBackground } from '../../components/ui/remote-image';

const HOLD_DURATION_MS = 15 * 60 * 1000;

// Habillage de marque des moyens de paiement (logo + sous-titre).
const METHOD_META: Record<string, { logo?: ImageSourcePropType; fit?: 'cover' | 'contain'; emoji?: string; badge?: string; badgeBg?: string; subtitle: string }> = {
  cash: { emoji: '💵', subtitle: 'À régler sur place' },
  wave: { logo: require('../../../assets/images/pay-wave.png'), subtitle: 'Paiement mobile instantané' },
  orange: { logo: require('../../../assets/images/pay-orange.webp'), subtitle: 'Orange Money' },
  mtn: { logo: require('../../../assets/images/pay-mtn.png'), subtitle: 'MTN MoMo' },
  moov: { logo: require('../../../assets/images/pay-moov.png'), fit: 'contain', subtitle: 'Moov Money' },
};
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
  const pendingReservations = useReservationCartStore((state) => state.pendingReservations);
  const setPendingReservations = useReservationCartStore((state) => state.setPendingReservations);
  const removePendingReservation = useReservationCartStore((state) => state.removePendingReservation);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [methods, setMethods] = useState<{ code: string; label: string }[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('cash');

  const loadCart = useCallback(async () => {
    try {
      const { data } = await apiClient.get<PendingReservationCart[]>('/api/v1/reservations/mine/cart');
      setPendingReservations(Array.isArray(data) ? data : []);
    } catch {
      // On garde l'éventuel état local pendant qu'un problème réseau temporaire
      // se résout ; aucune action de paiement n'est permise sans API.
    } finally {
      setLoading(false);
    }

    // Moyens de paiement activés — ré-essayé à CHAQUE affichage du panier
    // (évite de rester bloqué sur le repli si le 1er appel échoue au démarrage).
    try {
      const { data } = await apiClient.get<{ code: string; label: string }[]>('/api/v1/payments/methods');
      const list = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        setMethods(list);
        setSelectedMethod((current) => (list.some((m) => m.code === current) ? current : list[0].code));
      }
    } catch {
      setMethods((current) => (current.length > 0 ? current : [{ code: 'cash', label: 'Espèces' }]));
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

  const isExpired = useCallback(
    (r: PendingReservationCart) => new Date(r.created_at).getTime() + HOLD_DURATION_MS <= now,
    [now],
  );

  // Dès qu'une réservation expire, on recharge le panier (le backend l'a libérée).
  const hasExpired = pendingReservations.some(isExpired);
  useEffect(() => {
    if (hasExpired) void loadCart();
  }, [hasExpired, loadCart]);

  async function cancelReservation(id: string, afterCancel?: () => void) {
    if (actingId) return;
    try {
      setActingId(id);
      await apiClient.patch(`/api/v1/reservations/mine/${id}/cancel`);
      removePendingReservation(id);
      afterCancel?.();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'Impossible d’annuler la réservation. Réessaie.';
      Alert.alert('Annulation impossible', message);
    } finally {
      setActingId(null);
    }
  }

  function confirmCancel(id: string) {
    Alert.alert(
      'Annuler la réservation ?',
      'Le créneau sera immédiatement libéré pour les autres joueurs.',
      [
        { text: 'Conserver', style: 'cancel' },
        { text: 'Annuler le créneau', style: 'destructive', onPress: () => { void cancelReservation(id); } },
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
          onPress: () => {
            void cancelReservation(reservation.id, () => router.push(`/terrain/${reservation.terrain_id}/creneau`));
          },
        },
      ],
    );
  }

  async function checkout(reservation: PendingReservationCart) {
    if (actingId || isExpired(reservation)) return;
    try {
      setActingId(reservation.id);
      const { data } = await apiClient.post<{ reservation_id: string; status: 'accepted'; payment_method: string; cash: boolean }>(
        `/api/v1/payments/reservations/${reservation.id}/checkout`,
        { payment_method: selectedMethod },
      );
      removePendingReservation(reservation.id);
      router.replace({
        pathname: '/terrain/[id]/confirmation',
        params: {
          id: reservation.terrain_id,
          reservationId: data.reservation_id,
          date: reservation.reservation_date,
          start: String(reservation.start_hour),
          total: String(reservation.total_price),
          method: data.payment_method,
        },
      });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? 'La validation a échoué. Réessaie.';
      Alert.alert('Validation impossible', message);
      await loadCart();
    } finally {
      setActingId(null);
    }
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
        contentContainerStyle={{ padding: 20, paddingBottom: 42, gap: 16 }}
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
            {/* En-tête : nombre de réservations + moyen de paiement partagé */}
            <Text className="text-white/70 text-sm">
              {pendingReservations.length} réservation{pendingReservations.length > 1 ? 's' : ''} en attente · valide celles que tu souhaites.
            </Text>

            {/* Moyen de paiement (appliqué à la réservation que tu valides) */}
            <View>
              <Text className="text-white font-bold text-base mb-2">Moyen de paiement</Text>
              {methods.map((m) => {
                const active = selectedMethod === m.code;
                const meta = METHOD_META[m.code] ?? { subtitle: 'Mobile Money' };
                return (
                  <Pressable
                    key={m.code}
                    onPress={() => setSelectedMethod(m.code)}
                    className="flex-row items-center gap-3 rounded-btn p-3 mb-2.5"
                    style={{
                      borderWidth: 1.5,
                      borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.12)',
                      backgroundColor: active ? 'rgba(247,146,30,0.08)' : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <View style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: meta.badgeBg ?? 'rgba(255,255,255,0.08)' }}>
                      {meta.logo ? (
                        <Image source={meta.logo} style={{ width: 46, height: 46 }} resizeMode={meta.fit ?? 'cover'} />
                      ) : meta.badge ? (
                        <Text className="text-white font-black" style={{ fontSize: 13 }}>{meta.badge}</Text>
                      ) : (
                        <Text style={{ fontSize: 22 }}>{meta.emoji ?? '💳'}</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-base">{m.label}</Text>
                      <Text className="text-white/50 text-xs mt-0.5">{meta.subtitle}</Text>
                    </View>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                      {active ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#F7921E' }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Une carte par réservation en attente */}
            {pendingReservations.map((reservation) => {
              const expired = isExpired(reservation);
              const busy = actingId === reservation.id;
              const anyBusy = actingId !== null;
              const photo = imageThumb(reservation.terrain?.photos?.[0], 700);
              return (
                <View key={reservation.id} className="rounded-card overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  {photo ? (
                    <RemoteImageBackground uri={photo} contentFit="cover" style={{ height: 130 }}>
                      <View style={{ flex: 1, backgroundColor: 'rgba(13,31,13,0.28)' }} />
                    </RemoteImageBackground>
                  ) : null}
                  <View className="p-5">
                    <Text className="text-white text-lg font-black">{reservation.terrain?.name ?? 'Terrain'}</Text>
                    <Text className="text-white/60 text-sm mt-1">📍 {reservation.terrain?.city ?? 'Abidjan'}</Text>

                    <View className="h-px my-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <CartRow label="Date" value={formatDate(reservation.reservation_date)} />
                    <CartRow label="Créneau" value={`${time(reservation.start_hour)} – ${time(reservation.end_hour)}`} />
                    <CartRow label="Durée" value={`${reservation.duration_hours % 1 === 0 ? reservation.duration_hours : reservation.duration_hours.toFixed(1).replace('.', ',')} h`} />
                    <View className="h-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <CartRow label="Total" value={formatFcfa(reservation.total_price)} accent />

                    {/* Minuteur de maintien du créneau */}
                    <View className="rounded-btn p-3 flex-row items-center gap-3 mt-4" style={{ backgroundColor: expired ? 'rgba(248,113,113,0.1)' : 'rgba(247,146,30,0.1)', borderWidth: 1, borderColor: expired ? 'rgba(248,113,113,0.55)' : 'rgba(247,146,30,0.5)' }}>
                      <Text style={{ fontSize: 20 }}>{expired ? '⌛' : '⏱️'}</Text>
                      <View className="flex-1">
                        <Text className="text-white font-bold text-sm">{expired ? 'Créneau expiré' : `Créneau réservé : ${timeRemaining(reservation.created_at, now)}`}</Text>
                        <Text className="text-white/60 text-xs mt-0.5">{expired ? 'Actualisation du panier en cours…' : 'Valide avant la fin du délai.'}</Text>
                      </View>
                    </View>

                    {/* Actions par réservation */}
                    <View className="flex-row gap-2.5 mt-4">
                      <Pressable onPress={() => confirmEdit(reservation)} disabled={anyBusy || expired} className="flex-1 h-12 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.65)', opacity: anyBusy || expired ? 0.5 : 1 }}>
                        <Text style={{ color: '#4ADE80' }} className="font-bold text-sm">Modifier</Text>
                      </Pressable>
                      <Pressable onPress={() => confirmCancel(reservation.id)} disabled={anyBusy} className="flex-1 h-12 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(248,113,113,0.65)', opacity: anyBusy ? 0.5 : 1 }}>
                        <Text style={{ color: '#F87171' }} className="font-bold text-sm">Annuler</Text>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => checkout(reservation)} disabled={anyBusy || expired} className="h-13 rounded-btn items-center justify-center mt-2.5" style={{ backgroundColor: '#F7921E', opacity: (anyBusy && !busy) || expired ? 0.55 : 1 }}>
                      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold text-base">Valider la réservation</Text>}
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <Text className="text-white/45 text-center text-xs leading-5">
              {selectedMethod === 'cash'
                ? 'Paiement en espèces : la réservation est confirmée, à régler sur place au partenaire.'
                : 'Paiement Mobile Money en mode simulé pour l’instant (aucun débit réel).'}
            </Text>
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
