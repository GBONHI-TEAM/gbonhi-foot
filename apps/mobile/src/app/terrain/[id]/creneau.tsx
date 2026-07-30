import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ImageBackground, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { apiClient } from '../../../lib/api';
import {
  type TerrainDetail,
  type TerrainAvailability,
  formatFcfa,
} from '../../../types/terrain';

const OPEN_HOUR = 6;
const CLOSE_HOUR = 23; // dernière heure de fin possible (créneaux de 1 h)
const DAYS_AHEAD = 7;

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
  return `${String(h).padStart(2, '0')}h00`;
}

export default function CreneauPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const days = useMemo(buildDays, []);
  const [terrain, setTerrain] = useState<TerrainDetail | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(days[0]);
  const [availability, setAvailability] = useState<TerrainAvailability | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [startHour, setStartHour] = useState<number | null>(null);

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
        const { data } = await apiClient.get<TerrainAvailability>(
          `/api/v1/terrains/${id}/availability`,
          { params: { date: toYmd(selectedDate) } },
        );
        if (mounted) setAvailability(data);
      } catch {
        if (mounted) setAvailability({ date: toYmd(selectedDate), booked: [], pending: [], blocked: [] });
      } finally {
        if (mounted) setLoadingAvail(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, selectedDate]);

  const unavailable = useMemo(() => {
    const set = new Set<number>();
    availability?.booked.forEach((h) => set.add(h));
    availability?.pending.forEach((h) => set.add(h));
    availability?.blocked.forEach((h) => set.add(h));
    return set;
  }, [availability]);

  // Heures de début possibles : 6 → 22 (créneaux de 1 h).
  const hours = useMemo(
    () => Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i),
    [],
  );

  const isToday = toYmd(selectedDate) === toYmd(new Date());
  const nowHour = new Date().getHours();

  function slotAvailable(h: number): boolean {
    if (h + 1 > CLOSE_HOUR) return false;
    if (isToday && h <= nowHour) return false;
    return !unavailable.has(h);
  }

  function onSelectHour(h: number) {
    if (!slotAvailable(h)) return;
    setStartHour(h === startHour ? null : h);
  }

  const total = terrain ? terrain.price_per_hour : 0;
  const endHour = startHour != null ? startHour + 1 : null;

  function onContinue() {
    if (startHour == null || endHour == null) return;
    router.push({
      pathname: '/terrain/[id]/recap',
      params: {
        id: String(id),
        date: toYmd(selectedDate),
        start: String(startHour),
        end: String(endHour),
        duration: '1',
      },
    });
  }

  return (
    <ScreenBackground>
      {/* Header kente (maquette s24) */}
      <ImageBackground
        source={require('../../../../assets/images/kente-green.png')}
        resizeMode="repeat"
        style={{ paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' }}
        imageStyle={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <View className="flex-row items-center">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/terrain'))} hitSlop={8} style={{ width: 32 }}>
            <Text className="text-white text-xl">←</Text>
          </Pressable>
          <View className="flex-1 items-center" style={{ marginRight: 32 }}>
            <Text className="text-white font-black text-xl">Choisir un créneau</Text>
            {terrain ? <Text className="text-white/80 text-sm mt-0.5">{terrain.name}</Text> : null}
          </View>
        </View>
      </ImageBackground>

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

        {loadingAvail ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="#F7921E" />
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
                <Text className="text-white/55 text-sm mt-0.5">Durée : 1 heure</Text>
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
          disabled={startHour == null}
          className="h-14 rounded-btn items-center justify-center"
          style={{ backgroundColor: '#F7921E', opacity: startHour == null ? 0.5 : 1 }}
        >
          <Text className="text-white font-bold text-base">Continuer</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
