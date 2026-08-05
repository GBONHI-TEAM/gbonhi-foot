import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { AppHeader } from '../../../components/ui/app-header';
import { apiClient } from '../../../lib/api';
import {
  type TerrainDetail,
  type TerrainAvailability,
  formatFcfa,
} from '../../../types/terrain';

const DAYS_AHEAD = 7;
const DURATIONS = [
  { value: 1, label: '1 h' },
  { value: 1.5, label: '1 h 30' },
  { value: 2, label: '2 h' },
  { value: 2.5, label: '2 h 30' },
  { value: 3, label: '3 h' },
] as const;

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function formatLongDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function hh(h: number): string {
  const wholeHours = Math.floor(h);
  return `${String(wholeHours).padStart(2, '0')}h${h % 1 === 0.5 ? '30' : '00'}`;
}

export default function CreneauPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const days = useMemo(buildDays, []);
  const [terrain, setTerrain] = useState<TerrainDetail | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(days[0]);
  const [availability, setAvailability] = useState<TerrainAvailability | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(1);

  // Terrain (prix + nom)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await apiClient.get<TerrainDetail>(`/api/v1/terrains/${id}`);
        if (mounted) setTerrain(data);
      } catch {
        /* le nom reste vide, non bloquant */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Disponibilités par date
  useEffect(() => {
    let mounted = true;
    setStartHour(null);
    (async () => {
      try {
        setLoadingAvail(true);
        setAvailabilityError(null);
        const { data } = await apiClient.get<TerrainAvailability>(
          `/api/v1/terrains/${id}/availability`,
          { params: { date: toYmd(selectedDate) } },
        );
        if (mounted) setAvailability(data);
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (mounted) {
          setAvailability(null);
          setAvailabilityError(
            status === 503
              ? 'La disponibilité du terrain est momentanément indisponible. Réessaie dans quelques secondes.'
              : 'Impossible de charger les créneaux. Vérifie ta connexion puis réessaie.',
          );
        }
      } finally {
        if (mounted) setLoadingAvail(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, selectedDate, availabilityRetry]);

  const unavailable = useMemo(() => {
    const set = new Set<number>();
    availability?.booked.forEach((h) => set.add(h));
    availability?.pending.forEach((h) => set.add(h));
    availability?.blocked.forEach((h) => set.add(h));
    return set;
  }, [availability]);

  /**
   * Les créneaux ne doivent jamais proposer les heures génériques 06h–23h
   * lorsqu'un partenaire a défini ses propres horaires. On construit donc la
   * grille à partir des ouvertures du terrain pour le jour sélectionné.
   *
   * Le repli 06h–23h conserve la compatibilité avec les anciens terrains qui
   * n'ont pas encore d'horaires renseignés dans le back-office.
   */
  const openingHours = useMemo(() => {
    const dayOfWeek = (selectedDate.getDay() + 6) % 7; // lundi = 0 en base
    const open = new Set<number>();
    const slots = terrain?.slots?.filter((slot) => slot.day_of_week === dayOfWeek) ?? [];

    for (const slot of slots) {
      for (let hour = slot.start_hour; hour < slot.end_hour; hour += 0.5) {
        open.add(Number(hour.toFixed(1)));
      }
    }

    if (open.size === 0) {
      for (let hour = 6; hour < 23; hour += 0.5) open.add(Number(hour.toFixed(1)));
    }
    return open;
  }, [selectedDate, terrain?.slots]);

  const hours = useMemo(() => [...openingHours].sort((a, b) => a - b), [openingHours]);

  const isToday = toYmd(selectedDate) === toYmd(new Date());
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  function slotAvailable(h: number): boolean {
    if (!openingHours.has(h)) return false;
    if (isToday && h <= nowHour) return false;
    for (let cursor = h; cursor < h + duration; cursor += 0.5) {
      const normalized = Number(cursor.toFixed(1));
      if (!openingHours.has(normalized) || unavailable.has(normalized)) return false;
    }
    return true;
  }

  function onSelectHour(h: number) {
    if (!slotAvailable(h)) return;
    setStartHour(h === startHour ? null : h);
  }

  const total = terrain ? Math.round(terrain.price_per_hour * duration) : 0;
  const endHour = startHour != null ? startHour + duration : null;

  function onContinue() {
    if (startHour == null || endHour == null) return;
    router.push({
      pathname: '/terrain/[id]/recap',
      params: {
        id: String(id),
        date: toYmd(selectedDate),
        start: String(startHour),
        end: String(endHour),
        duration: String(duration),
      },
    });
  }

  return (
    <ScreenBackground>
      <AppHeader
        title="Choisir un créneau"
        subtitle={terrain?.name}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/terrain'))}
        showLogo={false}
        centered
      />

      {/* Sélecteur de date */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 16 }}
        className="flex-grow-0"
      >
        {days.map((d) => {
          const active = toYmd(d) === toYmd(selectedDate);
          return (
            <Pressable
              key={toYmd(d)}
              onPress={() => setSelectedDate(d)}
              className="w-16 h-20 rounded-card items-center justify-center"
              style={{
                backgroundColor: active ? '#F7921E' : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.1)',
              }}
            >
              <Text className={`text-xs ${active ? 'text-white' : 'text-white/55'}`}>{WEEKDAYS[d.getDay()]}</Text>
              <Text className="text-2xl font-black mt-0.5 text-white">{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grille horaires */}
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="text-white font-black text-lg mb-4">Horaires — {formatLongDate(selectedDate)}</Text>

        <Text className="text-white/65 text-sm font-semibold mb-2">Durée souhaitée</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }} className="flex-grow-0">
          {DURATIONS.map((option) => {
            const selected = duration === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => { setDuration(option.value); setStartHour(null); }}
                className="h-10 rounded-full px-4 items-center justify-center"
                style={{ backgroundColor: selected ? '#F7921E' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: selected ? '#F7921E' : 'rgba(255,255,255,0.15)' }}
              >
                <Text className="text-sm font-bold" style={{ color: selected ? '#FFFFFF' : 'rgba(255,255,255,0.65)' }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loadingAvail ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="#F7921E" />
          </View>
        ) : availabilityError ? (
          <View className="rounded-card p-5 items-center" style={{ backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' }}>
            <Text className="text-white/75 text-center leading-5">{availabilityError}</Text>
            <Pressable onPress={() => setAvailabilityRetry((value) => value + 1)} className="mt-4 h-11 px-5 rounded-btn items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
              <Text className="text-white font-bold">Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
            {hours.map((h) => {
              const available = slotAvailable(h);
              const selected = startHour === h;
              return (
                <View key={h} style={{ width: '33.333%', padding: 6 }}>
                  <Pressable
                    onPress={() => onSelectHour(h)}
                    disabled={!available}
                    className="h-14 rounded-btn items-center justify-center"
                    style={{
                      backgroundColor: selected ? '#F7921E' : available ? 'rgba(30,122,58,0.18)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: selected ? '#F7921E' : available ? 'rgba(46,158,79,0.5)' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Text
                      className="text-base font-bold"
                      style={{
                        color: selected ? '#fff' : available ? '#4ADE80' : 'rgba(255,255,255,0.3)',
                        textDecorationLine: available ? 'none' : 'line-through',
                      }}
                    >
                      {hh(h)}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Légende */}
        <View className="flex-row items-center gap-5 mt-5">
          {[
            { c: '#2E9E4F', l: 'Disponible' },
            { c: '#F7921E', l: 'Sélectionné' },
            { c: 'rgba(255,255,255,0.25)', l: 'Occupé' },
          ].map((leg) => (
            <View key={leg.l} className="flex-row items-center gap-2">
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: leg.c }} />
              <Text className="text-white/60 text-sm">{leg.l}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Barre de bas */}
      <View className="px-5 pt-3 pb-8" style={{ backgroundColor: '#0F3D1E' }}>
        <View className="flex-row items-center justify-between mb-3">
          <View>
            {startHour != null && endHour != null ? (
              <>
                <Text className="text-white font-bold text-base">
                  {formatLongDate(selectedDate)} · {hh(startHour)} → {hh(endHour)}
                </Text>
                <Text className="text-white/55 text-sm mt-0.5">Durée : {DURATIONS.find((option) => option.value === duration)?.label}</Text>
              </>
            ) : (
              <Text className="text-white/55 text-sm">Sélectionne un créneau</Text>
            )}
          </View>
          <View className="items-end">
            <Text className="text-white/50 text-xs">Total</Text>
            <Text className="text-accent text-xl font-black">{formatFcfa(total)}</Text>
          </View>
        </View>
        <Pressable
          onPress={onContinue}
          disabled={startHour == null || availabilityError !== null}
          className="h-14 rounded-btn items-center justify-center"
          style={{ backgroundColor: '#F7921E', opacity: startHour == null || availabilityError ? 0.5 : 1 }}
        >
          <Text className="text-white font-bold text-base">Continuer</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
