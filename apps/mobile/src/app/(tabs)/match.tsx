import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../../lib/api';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AppHeader } from '../../components/ui/app-header';
import {
  type Match,
  type League,
  formatMatchDate,
  formatMatchTime,
  matchStatusMeta,
  teamInitials,
  teamColor,
  isUpcoming,
} from '../../types/match';

function TeamPill({ name, color }: { name: string; color: string }) {
  return (
    <View
      className="w-9 h-9 rounded-full items-center justify-center"
      style={{ backgroundColor: color }}
    >
      <Text className="text-white font-black text-xs">{teamInitials(name)}</Text>
    </View>
  );
}

function MatchCard({ match, onPress }: { match: Match; onPress: () => void }) {
  const status = matchStatusMeta(match.status);
  const upcoming = isUpcoming(match.status);
  return (
    <Pressable
      onPress={onPress}
      className="px-4 py-3.5 rounded-2xl mb-3 active:opacity-90"
      style={{ backgroundColor: '#132913', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {match.round != null ? `J${match.round} · ` : ''}
          {formatMatchDate(match.scheduled_at)} · {formatMatchTime(match.scheduled_at)}
        </Text>
        <View
          className="flex-row items-center gap-1.5 px-2 py-0.5 rounded-full"
          style={{ backgroundColor: status.bg }}
        >
          {status.live ? (
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFFFFF' }} />
          ) : null}
          <Text className="text-xs font-bold tracking-wider" style={{ color: status.color }}>
            {status.label}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <TeamPill name={match.home_team.name} color={teamColor(match.home_team)} />
          <Text className="text-white font-semibold flex-1" numberOfLines={1}>
            {match.home_team.name}
          </Text>
        </View>

        {upcoming ? (
          <Text className="mx-2 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            VS
          </Text>
        ) : (
          <Text className="text-white font-black text-xl mx-2">
            {match.home_score} - {match.away_score}
          </Text>
        )}

        <View className="flex-row items-center gap-2 flex-1 justify-end">
          <Text className="text-white font-semibold flex-1 text-right" numberOfLines={1}>
            {match.away_team.name}
          </Text>
          <TeamPill name={match.away_team.name} color={teamColor(match.away_team)} />
        </View>
      </View>

      {match.venue ? (
        <Text className="text-xs mt-2.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          📍 {match.venue}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Section({ title, dotColor, children }: { title: string; dotColor?: string; children: React.ReactNode }) {
  return (
    <View className="mb-2">
      <View className="flex-row items-center gap-2 mb-3">
        {dotColor ? <View className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} /> : null}
        <Text className="text-white font-black text-lg">{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function MatchScreen() {
  const router = useRouter();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chargement des ligues (on garde celles ayant des matchs / en cours en priorité).
  const fetchLeagues = useCallback(async () => {
    try {
      const { data } = await apiClient.get<League[]>('/api/v1/leagues');
      setLeagues(data);
      setSelectedLeagueId((prev) => {
        if (prev && data.some((l) => l.id === prev)) return prev;
        const inProgress = data.find((l) => l.status === 'EN_COURS');
        return inProgress?.id ?? data[0]?.id ?? null;
      });
    } catch {
      setError('Impossible de charger les ligues.');
    } finally {
      setLoadingLeagues(false);
    }
  }, []);

  const fetchMatches = useCallback(async (leagueId: string, opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoadingMatches(true);
      const { data } = await apiClient.get<Match[]>('/api/v1/matches', {
        params: { tournament_id: leagueId },
      });
      setMatches(data);
      setError(null);
    } catch {
      setError('Impossible de charger les matchs.');
    } finally {
      if (!opts?.silent) setLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  useEffect(() => {
    if (selectedLeagueId) fetchMatches(selectedLeagueId);
    else setMatches([]);
  }, [selectedLeagueId, fetchMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeagues();
    if (selectedLeagueId) await fetchMatches(selectedLeagueId, { silent: true });
    setRefreshing(false);
  }, [fetchLeagues, fetchMatches, selectedLeagueId]);

  const { live, upcoming, results } = useMemo(() => {
    const live: Match[] = [];
    const upcoming: Match[] = [];
    const results: Match[] = [];
    for (const m of matches) {
      if (m.status === 'EN_COURS') live.push(m);
      else if (isUpcoming(m.status)) upcoming.push(m);
      else results.push(m);
    }
    upcoming.sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
    results.sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at));
    return { live, upcoming, results };
  }, [matches]);

  const goToMatch = (matchId: string) => router.push(`/match/${matchId}`);

  return (
    <ScreenBackground>
      <AppHeader title="Matchs" />

      {/* Sélecteur de ligue */}
      {leagues.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}
          className="flex-grow-0"
        >
          {leagues.map((l) => {
            const active = l.id === selectedLeagueId;
            return (
              <Pressable
                key={l.id}
                onPress={() => setSelectedLeagueId(l.id)}
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: active ? '#F7921E' : 'rgba(255,255,255,0.07)' }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}
                  numberOfLines={1}
                >
                  {l.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loadingLeagues || loadingMatches ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F7921E" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F7921E" />
          }
        >
          {matches.length === 0 ? (
            <View className="items-center justify-center py-24">
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
              <Text className="text-white/60 text-base text-center">
                {error ?? 'Aucun match programmé pour cette ligue.'}
              </Text>
            </View>
          ) : (
            <>
              {live.length > 0 ? (
                <Section title="En direct" dotColor="#E53935">
                  {live.map((m) => (
                    <MatchCard key={m.id} match={m} onPress={() => goToMatch(m.id)} />
                  ))}
                </Section>
              ) : null}

              {upcoming.length > 0 ? (
                <Section title="À venir" dotColor="#F7921E">
                  {upcoming.map((m) => (
                    <MatchCard key={m.id} match={m} onPress={() => goToMatch(m.id)} />
                  ))}
                </Section>
              ) : null}

              {results.length > 0 ? (
                <Section title="Résultats" dotColor="#4ADE80">
                  {results.map((m) => (
                    <MatchCard key={m.id} match={m} onPress={() => goToMatch(m.id)} />
                  ))}
                </Section>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </ScreenBackground>
  );
}
