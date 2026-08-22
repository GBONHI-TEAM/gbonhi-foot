import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient, matchShareLink } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { PatternedGreenHeader } from '../../../components/ui/patterned-green-header';
import {
  type MatchDetail,
  type MatchEvent,
  formatMatchDate,
  formatMatchTime,
  matchStatusMeta,
  teamInitials,
  teamColor,
  eventIcon,
  eventLabel,
  isUpcoming,
} from '../../../types/match';

/** Pastille couleur + initiales d'une équipe. */
function TeamBadge({ name, color, size = 56 }: { name: string; color: string; size?: number }) {
  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    >
      <Text className="text-white font-black" style={{ fontSize: size * 0.32 }}>
        {teamInitials(name)}
      </Text>
    </View>
  );
}

/** Point rouge pulsant du badge EN DIRECT. */
function LiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', opacity: pulse }}
    />
  );
}

/** Ligne de la timeline des faits de jeu. Aligné à gauche (domicile) ou droite (extérieur). */
function EventRow({ event, homeTeamId }: { event: MatchEvent; homeTeamId: string }) {
  const isHome = event.team?.id === homeTeamId;
  const content = (
    <View className="flex-1" style={{ alignItems: isHome ? 'flex-start' : 'flex-end' }}>
      <Text className="text-white text-sm font-semibold" style={{ textAlign: isHome ? 'left' : 'right' }}>
        {event.player?.full_name ?? event.team?.name ?? '—'}
      </Text>
      <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', textAlign: isHome ? 'left' : 'right' }}>
        {eventLabel(event.type)}
      </Text>
    </View>
  );

  return (
    <View className="flex-row items-center py-3">
      {isHome ? content : <View className="flex-1" />}
      <View className="items-center justify-center px-3" style={{ width: 72 }}>
        <Text style={{ fontSize: 18 }}>{eventIcon(event.type)}</Text>
        <Text className="text-xs font-bold mt-0.5" style={{ color: '#F7921E' }}>
          {event.minute}&apos;
        </Text>
      </View>
      {isHome ? <View className="flex-1" /> : content}
    </View>
  );
}

export default function MatchDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatch = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return;
      try {
        if (!opts?.silent) setLoading(true);
        const { data } = await apiClient.get<MatchDetail>(`/api/v1/matches/${id}`);
        setMatch(data);
        setError(null);
      } catch {
        setError('Impossible de charger le match.');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [id],
  );

  // Chargement initial.
  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  // Temps réel : à chaque changement sur le match ou ses événements, on refetch.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`match-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        () => fetchMatch({ silent: true }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${id}` },
        () => fetchMatch({ silent: true }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchMatch]);

  const onShare = useCallback(async () => {
    if (!match) return;
    const status = matchStatusMeta(match.status);
    const scoreLine = isUpcoming(match.status)
      ? `${match.home_team.name} vs ${match.away_team.name}`
      : `${match.home_team.name} ${match.home_score} - ${match.away_score} ${match.away_team.name}`;
    const meta = isUpcoming(match.status)
      ? `${formatMatchDate(match.scheduled_at)} · ${formatMatchTime(match.scheduled_at)}`
      : status.label;
    try {
      const link = matchShareLink(match.id);
      await Share.share({
        message: `⚽ ${scoreLine}\n${meta}${match.venue ? `\n📍 ${match.venue}` : ''}\n\nSuis le match sur GBONHI FOOT 👇\n${link}`,
      });
    } catch {
      // partage annulé — no-op
    }
  }, [match]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0D1F0D' }}>
        <ActivityIndicator color="#F7921E" />
      </View>
    );
  }

  if (error || !match) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#0D1F0D' }}>
        <PatternedGreenHeader style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }} patternOpacity={0.5}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/match'))} hitSlop={8}>
            <Text className="text-white text-2xl">←</Text>
          </Pressable>
        </PatternedGreenHeader>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white/60 text-center text-base">{error ?? 'Match introuvable.'}</Text>
          <Pressable
            onPress={() => fetchMatch()}
            className="mt-4 px-5 h-11 rounded-btn items-center justify-center"
            style={{ backgroundColor: '#F7921E' }}
          >
            <Text className="text-white font-bold">Réessayer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const status = matchStatusMeta(match.status);
  const upcoming = isUpcoming(match.status);
  const events = [...match.events].sort((a, b) => a.minute - b.minute);

  return (
    <View className="flex-1" style={{ backgroundColor: '#0D1F0D' }}>
      {/* Header vert à motifs triangulaires */}
      <PatternedGreenHeader style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 }} patternOpacity={0.36}>
        <View className="flex-row items-center justify-between mb-4">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/match'))} hitSlop={8}>
            <Text className="text-white text-2xl">←</Text>
          </Pressable>
          <Pressable
            onPress={onShare}
            hitSlop={8}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Text style={{ fontSize: 14 }}>📤</Text>
            <Text className="text-white text-sm font-semibold">Partager</Text>
          </Pressable>
        </View>

        {/* Badge statut */}
        <View className="items-center mb-4">
          <View
            className="flex-row items-center gap-2 px-3 py-1 rounded-full"
            style={{ backgroundColor: status.bg }}
          >
            {status.live ? <LiveDot /> : null}
            <Text className="text-xs font-black tracking-widest" style={{ color: status.color }}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* Équipes + score */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 items-center">
            <TeamBadge name={match.home_team.name} color={teamColor(match.home_team)} />
            <Text className="text-white font-bold text-sm mt-2 text-center" numberOfLines={2}>
              {match.home_team.name}
            </Text>
          </View>

          <View className="items-center px-3" style={{ minWidth: 110 }}>
            {upcoming ? (
              <>
                <Text className="text-white/50 text-xs">{formatMatchDate(match.scheduled_at)}</Text>
                <Text className="text-white font-black text-3xl mt-1">
                  {formatMatchTime(match.scheduled_at)}
                </Text>
              </>
            ) : (
              <Text className="text-white font-black" style={{ fontSize: 52, lineHeight: 58 }}>
                {match.home_score} : {match.away_score}
              </Text>
            )}
          </View>

          <View className="flex-1 items-center">
            <TeamBadge name={match.away_team.name} color={teamColor(match.away_team)} />
            <Text className="text-white font-bold text-sm mt-2 text-center" numberOfLines={2}>
              {match.away_team.name}
            </Text>
          </View>
        </View>

        {/* Journée + terrain */}
        <View className="flex-row items-center justify-center gap-3 mt-4">
          {match.round != null ? (
            <Text className="text-white/60 text-xs font-semibold">Journée {match.round}</Text>
          ) : null}
          {match.round != null && match.venue ? (
            <Text className="text-white/30 text-xs">·</Text>
          ) : null}
          {match.venue ? <Text className="text-white/60 text-xs">📍 {match.venue}</Text> : null}
        </View>
      </PatternedGreenHeader>

      {/* Timeline des faits de jeu */}
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20, paddingBottom: 40 }}>
        <Text className="text-white font-black text-lg mb-2">Faits de jeu</Text>
        {events.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text style={{ fontSize: 34, marginBottom: 8 }}>⚽</Text>
            <Text className="text-white/50 text-sm text-center">
              {upcoming ? 'Le match n\'a pas encore commencé.' : 'Aucun fait de jeu enregistré.'}
            </Text>
          </View>
        ) : (
          <View>
            {events.map((ev, idx) => (
              <View
                key={ev.id}
                style={{
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <EventRow event={ev} homeTeamId={match.home_team.id} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
