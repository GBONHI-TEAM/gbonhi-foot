import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '../../components/ui/app-header';
import { ScreenBackground } from '../../components/ui/screen-background';
import { apiClient } from '../../lib/api';
import { formatFcfa } from '../../types/terrain';
import { useReservationCartStore } from '../../store/reservation-cart.store';
import { METHOD_META, formatDate, time, timeRemaining, isReservationExpired } from '../../lib/cart-format';

export default function CartPaymentScreen() {
  const router = useRouter();
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const pendingReservations = useReservationCartStore((state) => state.pendingReservations);
  const removePendingReservation = useReservationCartStore((state) => state.removePendingReservation);

  const reservation = useMemo(
    () => pendingReservations.find((r) => r.id === reservationId) ?? null,
    [pendingReservations, reservationId],
  );

  const [methods, setMethods] = useState<{ code: string; label: string }[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get<{ code: string; label: string }[]>('/api/v1/payments/methods');
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setMethods(list);
          setSelectedMethod((c) => (list.some((m) => m.code === c) ? c : list[0].code));
        } else {
          setMethods([{ code: 'cash', label: 'Espèces' }]);
        }
      } catch {
        setMethods([{ code: 'cash', label: 'Espèces' }]);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const expired = reservation ? isReservationExpired(reservation.created_at, now) : false;

  const goBackToCart = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/cart');
  }, [router]);

  // Réservation absente du panier (expirée / retirée) → retour au panier.
  useEffect(() => {
    if (!reservation) goBackToCart();
  }, [reservation, goBackToCart]);

  async function removeAndLeave(afterRemove?: () => void) {
    if (!reservation || busy) return;
    try {
      setBusy(true);
      await apiClient.patch(`/api/v1/reservations/mine/${reservation.id}/cancel`);
      removePendingReservation(reservation.id);
      (afterRemove ?? goBackToCart)();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action impossible. Réessaie.';
      Alert.alert('Action impossible', message);
    } finally {
      setBusy(false);
    }
  }

  function onModifier() {
    if (!reservation) return;
    Alert.alert('Modifier le créneau ?', 'Le créneau actuel sera libéré. Tu pourras en choisir un autre.', [
      { text: 'Retour', style: 'cancel' },
      { text: 'Modifier', onPress: () => { void removeAndLeave(() => router.replace(`/terrain/${reservation.terrain_id}/creneau`)); } },
    ]);
  }

  function onAnnuler() {
    Alert.alert('Annuler la réservation ?', 'Le créneau sera libéré pour les autres joueurs.', [
      { text: 'Conserver', style: 'cancel' },
      { text: 'Annuler', style: 'destructive', onPress: () => { void removeAndLeave(); } },
    ]);
  }

  async function onPay() {
    if (!reservation || busy || expired) return;
    try {
      setBusy(true);
      const { data } = await apiClient.post<{ reservation_id: string; payment_method: string; cash: boolean }>(
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
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Le paiement a échoué. Réessaie.';
      Alert.alert('Paiement impossible', message);
    } finally {
      setBusy(false);
    }
  }

  if (!reservation) {
    return (
      <ScreenBackground>
        <AppHeader title="Paiement" showLogo={false} centered onBack={goBackToCart} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      </ScreenBackground>
    );
  }

  const dur = reservation.duration_hours % 1 === 0 ? reservation.duration_hours : reservation.duration_hours.toFixed(1).replace('.', ',');

  return (
    <ScreenBackground>
      <AppHeader title="Paiement" showLogo={false} centered onBack={goBackToCart} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 42, gap: 16 }}>
        {/* Récapitulatif compact de la réservation */}
        <View className="rounded-card p-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text className="text-white text-base font-black">{reservation.terrain?.name ?? 'Terrain'}</Text>
          <Text className="text-white/55 text-xs mt-0.5">📍 {reservation.terrain?.city ?? 'Abidjan'}</Text>
          <View className="h-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <Row label="Date" value={formatDate(reservation.reservation_date)} />
          <Row label="Créneau" value={`${time(reservation.start_hour)} – ${time(reservation.end_hour)}`} />
          <Row label="Durée" value={`${dur} h`} />
          <View className="h-px my-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <Row label="Total" value={formatFcfa(reservation.total_price)} accent />
        </View>

        {/* Délai de validité */}
        <View className="rounded-btn p-3 flex-row items-center gap-3" style={{ backgroundColor: expired ? 'rgba(248,113,113,0.1)' : 'rgba(247,146,30,0.1)', borderWidth: 1, borderColor: expired ? 'rgba(248,113,113,0.55)' : 'rgba(247,146,30,0.5)' }}>
          <Text style={{ fontSize: 20 }}>{expired ? '⌛' : '⏱️'}</Text>
          <View className="flex-1">
            <Text className="text-white font-bold text-sm">{expired ? 'Créneau expiré' : `Créneau réservé : ${timeRemaining(reservation.created_at, now)}`}</Text>
            <Text className="text-white/60 text-xs mt-0.5">{expired ? 'Retour au panier…' : 'Paie avant la fin du délai.'}</Text>
          </View>
        </View>

        {/* Choix du moyen de paiement */}
        <View>
          <Text className="text-white font-bold text-base mb-2">Moyen de paiement</Text>
          {methods.map((m) => {
            const active = selectedMethod === m.code;
            const meta = METHOD_META[m.code] ?? {};
            return (
              <Pressable
                key={m.code}
                onPress={() => setSelectedMethod(m.code)}
                className="flex-row items-center gap-3 rounded-btn p-3 mb-2.5"
                style={{ borderWidth: 1.5, borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.12)', backgroundColor: active ? 'rgba(247,146,30,0.08)' : 'rgba(255,255,255,0.04)' }}
              >
                <View style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  {meta.logo ? (
                    <Image source={meta.logo} style={{ width: 46, height: 46 }} resizeMode={meta.fit ?? 'cover'} />
                  ) : (
                    <Text style={{ fontSize: 22 }}>{meta.emoji ?? '💳'}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">{m.label}</Text>
                  {meta.subtitle ? <Text className="text-white/50 text-xs mt-0.5">{meta.subtitle}</Text> : null}
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                  {active ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#F7921E' }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Payer (mis en valeur, en premier) puis Modifier + Annuler */}
        <Pressable onPress={onPay} disabled={busy || expired} className="h-14 rounded-btn items-center justify-center" style={{ backgroundColor: '#F7921E', opacity: expired ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-black text-base">💳 Payer ma réservation</Text>}
        </Pressable>
        <View className="flex-row gap-2.5">
          <Pressable onPress={onModifier} disabled={busy || expired} className="flex-1 h-12 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(46,158,79,0.65)', opacity: busy || expired ? 0.5 : 1 }}>
            <Text style={{ color: '#4ADE80' }} className="font-bold text-sm">Modifier</Text>
          </Pressable>
          <Pressable onPress={onAnnuler} disabled={busy} className="flex-1 h-12 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(248,113,113,0.65)', opacity: busy ? 0.5 : 1 }}>
            <Text style={{ color: '#F87171' }} className="font-bold text-sm">Annuler</Text>
          </Pressable>
        </View>

        <Text className="text-white/45 text-center text-xs leading-5">
          {selectedMethod === 'cash'
            ? 'Paiement en espèces : la réservation est confirmée, à régler sur place au partenaire.'
            : 'Paiement Mobile Money en mode simulé pour l’instant (aucun débit réel).'}
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5 gap-4">
      <Text className="text-white/55 text-base">{label}</Text>
      <Text className="font-bold text-base text-right" style={{ color: accent ? '#F7921E' : '#FFFFFF' }}>{value}</Text>
    </View>
  );
}
