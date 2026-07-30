import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { apiClient } from '../../../lib/api';
import { imageThumb } from '../../../lib/image';
import {
  type Match,
  type League,
  type Standing,
  type ScorersResponse,
  type ScorerRow,
  formatMatchDate,
  formatMatchTime,
  matchStatusMeta,
  teamInitials,
  teamColor,
  isUpcoming,
} from '../../../types/match';

const TABS = ['Infos', 'Règlement', 'Récompenses', 'Équipes', 'Matchs', 'Classement', 'Stats'] as const;
type Tab = (typeof TABS)[number];

const MONTHS_FULL = [
  'jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc',
];
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

const LEAGUE_STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon',
  INSCRIPTIONS_OUVERTES: 'Inscriptions ouvertes',
  INSCRIPTIONS_CLOSES: 'Inscriptions closes',
  EN_COURS: 'En cours',
  SUSPENDUE: 'Suspendue',
  TERMINÉE: 'Terminée',
  ARCHIVÉE: 'Archivée',
};

/* ───────────────────────── Onglet Infos ───────────────────────── */

function TabInfos({ league }: { league: League }) {
  const stats = [
    { label: 'Dates', value: `${shortDate(league.start_date)} — ${shortDate(league.end_date)}` },
    { label: 'Niveau', value: league.level?.trim() || '—' },
    { label: 'Équipes', value: `${league._count?.teams ?? 0} / ${league.max_teams} inscrites` },
    { label: 'Matchs / équipe', value: league.matches_per_team != null ? String(league.matches_per_team) : '—' },
    { label: 'Format', value: ({ round_robin: 'Championnat', single_elimination: 'Coupe', double_elimination: 'Coupe (double élim.)', league: 'Championnat + Play-offs' } as Record<string, string>)[league.format ?? ''] ?? (league.format ?? '—') },
    ...(league.registration_fee ? [{ label: 'Inscription', value: `${league.registration_fee.toLocaleString('fr-FR')} FCFA` }] : []),
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} className="mb-6">
        {stats.map(({ label, value }) => (
          <View
            key={label}
            className="rounded-xl p-3.5"
            style={{ minWidth: '45%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <Text className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</Text>
            <Text className="text-white font-bold text-sm">{value}</Text>
          </View>
        ))}
      </View>

      {league.prize_info ? (
        <>
          <Text className="text-white font-bold text-base mb-2">Dotation</Text>
          <View
            className="rounded-2xl p-4 mb-6"
            style={{ backgroundColor: 'rgba(255,184,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,184,48,0.2)' }}
          >
            <Text className="text-base font-bold" style={{ color: '#FFB830' }}>{league.prize_info}</Text>
          </View>
        </>
      ) : null}

      <Text className="text-white font-bold text-base mb-2">À propos</Text>
      <Text className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {league.description?.trim() || 'Aucune description disponible pour cette ligue.'}
      </Text>

      {league.location ? (
        <Text className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.5)' }}>📍 {league.location}</Text>
      ) : null}
    </ScrollView>
  );
}

/* ───────────────────────── Onglet Équipes ───────────────────────── */

interface LeagueTeamEntry {
  team: {
    id: string;
    name: string;
    primary_color?: string | null;
    _count?: { members: number };
    home_terrain?: { id: string; name: string; city: string } | null;
  };
}

function TabEquipes({ teams }: { teams: LeagueTeamEntry[] }) {
  if (teams.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <Text className="text-white/50 text-sm">Aucune équipe inscrite pour le moment.</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {teams.map(({ team }) => (
        <View
          key={team.id}
          className="flex-row items-center gap-3 px-4 py-3.5 rounded-xl mb-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: team.primary_color || '#1E7A3A' }}
          >
            <Text className="text-white font-black text-xs">{teamInitials(team.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-sm">{team.name}</Text>
            <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {team._count?.members ?? 0} joueurs
              {team.home_terrain ? ` · ${team.home_terrain.name}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ───────────────────────── Onglet Matchs (s14) ───────────────────────── */

function TabMatchs({
  matches,
  loading,
  onOpen,
}: {
  matches: Match[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  // Regroupement par journée (round), triées.
  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    const sorted = [...matches].sort((a, b) => {
      const ra = a.round ?? 9999;
      const rb = b.round ?? 9999;
      if (ra !== rb) return ra - rb;
      return +new Date(a.scheduled_at) - +new Date(b.scheduled_at);
    });
    for (const m of sorted) {
      const key = m.round != null ? `Journée ${m.round}` : 'Autres matchs';
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [matches]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <ActivityIndicator color="#F7921E" />
      </View>
    );
  }
  if (matches.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <Text style={{ fontSize: 36, marginBottom: 10 }}>📅</Text>
        <Text className="text-white/50 text-sm">Aucun match programmé.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {grouped.map(([journee, list]) => (
        <View key={journee} className="mb-5">
          {/* En-tête journée */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-black text-sm" style={{ color: '#F7921E' }}>{journee}</Text>
            <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {formatMatchDate(list[0].scheduled_at)}
            </Text>
          </View>

          {list.map((m) => {
            const status = matchStatusMeta(m.status);
            const upcoming = isUpcoming(m.status);
            return (
              <Pressable
                key={m.id}
                onPress={() => onOpen(m.id)}
                className="rounded-2xl p-4 mb-3 active:opacity-90"
                style={{ backgroundColor: '#132913', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="font-bold text-sm" style={{ color: '#F7921E' }}>
                    {formatMatchTime(m.scheduled_at)}
                  </Text>
                  <View
                    className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: status.bg }}
                  >
                    {status.live ? (
                      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFFFFF' }} />
                    ) : null}
                    <Text className="text-xs font-bold" style={{ color: status.color }}>{status.label}</Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2 flex-1">
                    <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: teamColor(m.home_team) }}>
                      <Text className="text-white font-black text-[10px]">{teamInitials(m.home_team.name)}</Text>
                    </View>
                    <Text className="text-white font-bold flex-1" numberOfLines={1}>{m.home_team.name}</Text>
                  </View>
                  {upcoming ? (
                    <Text className="mx-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>VS</Text>
                  ) : (
                    <Text className="text-white font-black text-lg mx-2">{m.home_score} - {m.away_score}</Text>
                  )}
                  <View className="flex-row items-center gap-2 flex-1 justify-end">
                    <Text className="text-white font-bold flex-1 text-right" numberOfLines={1}>{m.away_team.name}</Text>
                    <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: teamColor(m.away_team) }}>
                      <Text className="text-white font-black text-[10px]">{teamInitials(m.away_team.name)}</Text>
                    </View>
                  </View>
                </View>

                {m.venue ? (
                  <Text className="text-xs mt-2.5 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>📍 {m.venue}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

/* ───────────────────────── Onglet Classement (s15) ───────────────────────── */

function TabClassement({ standings, loading }: { standings: Standing[]; loading: boolean }) {
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <ActivityIndicator color="#F7921E" />
      </View>
    );
  }
  if (standings.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <Text className="text-white/50 text-sm">Classement indisponible (aucun match validé).</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View className="rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
        {/* Header */}
        <View className="flex-row items-center px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
          <Text className="text-xs font-semibold text-center" style={{ color: 'rgba(255,255,255,0.45)', width: 28 }}>#</Text>
          <Text className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)', flex: 1, marginLeft: 8 }}>Équipe</Text>
          {['J', 'G', 'N', 'P', 'Diff'].map((h) => (
            <Text key={h} className="text-xs font-semibold text-center" style={{ color: 'rgba(255,255,255,0.45)', width: 30 }}>{h}</Text>
          ))}
          <Text className="text-xs font-black text-center" style={{ color: '#F7921E', width: 34 }}>Pts</Text>
        </View>

        {standings.map((s, idx) => {
          const highlight = s.rank === 1;
          const podium = s.rank <= 3;
          const accent = s.rank === 1 ? '#F7921E' : '#2E9E4F';
          return (
            <View
              key={s.team.id}
              className="flex-row items-center px-3 py-3"
              style={{
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: 'rgba(255,255,255,0.06)',
                borderLeftWidth: podium ? 3 : 0,
                borderLeftColor: podium ? accent : 'transparent',
                backgroundColor: highlight ? 'rgba(247,146,30,0.12)' : undefined,
              }}
            >
              <Text
                className="text-xs font-black text-center"
                style={{ color: podium ? accent : 'rgba(255,255,255,0.5)', width: 28 }}
              >
                {s.rank}
              </Text>
              <View className="flex-row items-center gap-2" style={{ flex: 1, marginLeft: 8 }}>
                <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: teamColor(s.team) }}>
                  <Text className="text-white font-black" style={{ fontSize: 9 }}>{teamInitials(s.team.name)}</Text>
                </View>
                <Text className="text-white text-xs font-semibold flex-1" numberOfLines={1}>{s.team.name}</Text>
              </View>
              {[s.played, s.won, s.drawn, s.lost].map((v, i) => (
                <Text key={i} className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.7)', width: 30 }}>{v}</Text>
              ))}
              <Text
                className="text-xs font-semibold text-center"
                style={{ color: s.goal_diff > 0 ? '#4ADE80' : s.goal_diff < 0 ? '#F87171' : 'rgba(255,255,255,0.6)', width: 30 }}
              >
                {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
              </Text>
              <Text className="text-white font-black text-xs text-center" style={{ width: 34 }}>{s.points}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ───────────────────────── Onglet Stats (s16) ───────────────────────── */

function ScorerList({ rows, unit, accent }: { rows: ScorerRow[]; unit: string; accent: string }) {
  return (
    <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
      {rows.map((r, idx) => {
        const podium = idx < 3;
        const rankColor = idx === 0 ? '#F7921E' : idx < 3 ? '#2E9E4F' : 'rgba(255,255,255,0.4)';
        return (
          <View
            key={r.player?.id ?? idx}
            className="flex-row items-center px-4 py-3"
            style={{
              borderTopWidth: idx > 0 ? 1 : 0,
              borderTopColor: 'rgba(255,255,255,0.06)',
              borderLeftWidth: podium ? 3 : 0,
              borderLeftColor: podium ? rankColor : 'transparent',
              backgroundColor: idx === 0 ? 'rgba(247,146,30,0.1)' : undefined,
            }}
          >
            <Text className="font-black text-sm" style={{ color: rankColor, width: 24 }}>{idx + 1}</Text>
            <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#1E7A3A' }}>
              <Text className="text-white font-black text-[10px]">
                {teamInitials(r.player?.full_name ?? '??')}
              </Text>
            </View>
            <Text className="text-white font-bold text-sm flex-1" numberOfLines={1}>
              {r.player?.full_name ?? 'Joueur inconnu'}
            </Text>
            <Text className="font-black text-sm" style={{ color: accent }}>
              {r.count} <Text className="font-normal text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{unit}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TabStats({ scorers, loading }: { scorers: ScorersResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <ActivityIndicator color="#F7921E" />
      </View>
    );
  }
  const topScorers = scorers?.scorers ?? [];
  const topAssisters = scorers?.assisters ?? [];
  const mvp = topScorers[0];

  if (topScorers.length === 0 && topAssisters.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <Text className="text-white/50 text-sm">Aucune statistique disponible pour le moment.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Carte MVP (meilleur buteur) */}
      {mvp ? (
        <View
          className="rounded-2xl p-5 mb-6 flex-row items-center gap-4"
          style={{ backgroundColor: 'rgba(247,146,30,0.12)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.3)' }}
        >
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: '#1E7A3A', borderWidth: 2, borderColor: '#F7921E' }}
          >
            <Text className="text-white font-black text-xl">{teamInitials(mvp.player?.full_name ?? '??')}</Text>
          </View>
          <View className="flex-1">
            <View className="self-start px-2.5 py-1 rounded-full mb-2" style={{ backgroundColor: '#F7921E' }}>
              <Text className="text-white text-xs font-black tracking-wider">★ MEILLEUR BUTEUR</Text>
            </View>
            <Text className="text-white font-black text-lg">{mvp.player?.full_name ?? 'Joueur inconnu'}</Text>
            <Text className="font-black text-base mt-1" style={{ color: '#F7921E' }}>
              {mvp.count} <Text className="text-white/60 font-normal text-sm">but{mvp.count > 1 ? 's' : ''}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      {topScorers.length > 0 ? (
        <>
          <Text className="text-white font-black text-base mb-3">⚽ Meilleurs buteurs</Text>
          <View className="mb-6">
            <ScorerList rows={topScorers} unit="buts" accent="#F7921E" />
          </View>
        </>
      ) : null}

      {topAssisters.length > 0 ? (
        <>
          <Text className="text-white font-black text-base mb-3">🎯 Meilleurs passeurs</Text>
          <ScorerList rows={topAssisters} unit="passes" accent="#4ADE80" />
        </>
      ) : null}
    </ScrollView>
  );
}

/* ───────────────────────── Écran ───────────────────────── */

export default function LeagueDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('Infos');

  const [league, setLeague] = useState<(League & { teams?: LeagueTeamEntry[] }) | null>(null);
  const [loadingLeague, setLoadingLeague] = useState(true);

  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesLoaded, setMatchesLoaded] = useState(false);

  const [standings, setStandings] = useState<Standing[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [standingsLoaded, setStandingsLoaded] = useState(false);

  const [scorers, setScorers] = useState<ScorersResponse | null>(null);
  const [loadingScorers, setLoadingScorers] = useState(false);
  const [scorersLoaded, setScorersLoaded] = useState(false);

  // Ligue (infos + équipes).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await apiClient.get<League & { teams?: LeagueTeamEntry[] }>(`/api/v1/leagues/${id}`);
        if (mounted) setLeague(data);
      } catch {
        if (mounted) setLeague(null);
      } finally {
        if (mounted) setLoadingLeague(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const loadMatches = useCallback(async () => {
    if (matchesLoaded) return;
    setLoadingMatches(true);
    try {
      const { data } = await apiClient.get<Match[]>('/api/v1/matches', { params: { tournament_id: id } });
      setMatches(data);
    } catch {
      setMatches([]);
    } finally {
      setLoadingMatches(false);
      setMatchesLoaded(true);
    }
  }, [id, matchesLoaded]);

  const loadStandings = useCallback(async () => {
    if (standingsLoaded) return;
    setLoadingStandings(true);
    try {
      const { data } = await apiClient.get<Standing[]>(`/api/v1/leagues/${id}/standings`);
      setStandings(data);
    } catch {
      setStandings([]);
    } finally {
      setLoadingStandings(false);
      setStandingsLoaded(true);
    }
  }, [id, standingsLoaded]);

  const loadScorers = useCallback(async () => {
    if (scorersLoaded) return;
    setLoadingScorers(true);
    try {
      const { data } = await apiClient.get<ScorersResponse>('/api/v1/matches/scorers', {
        params: { tournament_id: id },
      });
      setScorers(data);
    } catch {
      setScorers({ scorers: [], assisters: [] });
    } finally {
      setLoadingScorers(false);
      setScorersLoaded(true);
    }
  }, [id, scorersLoaded]);

  // Chargement paresseux au changement d'onglet.
  useEffect(() => {
    if (activeTab === 'Matchs') loadMatches();
    else if (activeTab === 'Classement') loadStandings();
    else if (activeTab === 'Stats') loadScorers();
  }, [activeTab, loadMatches, loadStandings, loadScorers]);

  if (loadingLeague) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0D1F0D' }}>
        <ActivityIndicator color="#F7921E" />
      </View>
    );
  }

  if (!league) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#0D1F0D' }}>
        <View className="px-5 pt-14 pb-4" style={{ backgroundColor: '#1E7A3A' }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-white text-2xl">‹</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-white/60">Ligue introuvable.</Text>
        </View>
      </View>
    );
  }

  const statusLabel = LEAGUE_STATUS_LABEL[league.status] ?? league.status;
  const canRegister = league.status === 'INSCRIPTIONS_OUVERTES';

  return (
    <ScreenBackground>
      {/* Hero header */}
      <View className="pb-0" style={{ backgroundColor: '#1E7A3A' }}>
        {league.banner_url ? (
          <>
            <Image source={{ uri: imageThumb(league.banner_url, 900) }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,31,13,0.55)' }} />
          </>
        ) : null}
        <View className="flex-row items-center px-5 pt-14 pb-3 gap-2">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-white text-2xl">‹</Text>
          </Pressable>
          <View className="self-start px-2.5 py-0.5 rounded-full ml-2" style={{ backgroundColor: '#0F3D1E' }}>
            <Text className="text-xs font-black tracking-widest text-white">{statusLabel.toUpperCase()}</Text>
          </View>
        </View>
        <View className="px-5 pb-4">
          <Text className="text-white font-black text-xl leading-tight mb-1">{league.name}</Text>
          {league.location ? (
            <Text className="text-white/75 text-sm">📍 {league.location}</Text>
          ) : null}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <View className="flex-row gap-1">
            {TABS.map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className="px-4 py-2.5 rounded-t-lg"
                style={{ backgroundColor: activeTab === tab ? '#0D1F0D' : 'transparent' }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: activeTab === tab ? '#F7921E' : 'rgba(255,255,255,0.65)' }}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Contenu */}
      <View className="flex-1">
        {activeTab === 'Infos' && <TabInfos league={league} />}
        {activeTab === 'Équipes' && <TabEquipes teams={league.teams ?? []} />}
        {activeTab === 'Matchs' && (
          <TabMatchs matches={matches} loading={loadingMatches} onOpen={(mid) => router.push(`/match/${mid}`)} />
        )}
        {activeTab === 'Classement' && <TabClassement standings={standings} loading={loadingStandings} />}
        {activeTab === 'Stats' && <TabStats scorers={scorers} loading={loadingScorers} />}
        {activeTab === 'Règlement' && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <Text className="text-white font-bold text-base mb-3">Règlement de la ligue</Text>
            {league.rules?.trim() ? (
              <Text className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{league.rules}</Text>
            ) : (
              <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Aucun règlement publié pour cette ligue.</Text>
            )}
          </ScrollView>
        )}
        {activeTab === 'Récompenses' && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <Text className="text-white font-bold text-base mb-3">Récompenses</Text>
            {league.prize_info?.trim() ? (
              <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'rgba(255,184,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,184,48,0.25)' }}>
                <Text className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Dotation totale</Text>
                <Text className="text-lg font-black" style={{ color: '#FFB830' }}>{league.prize_info}</Text>
              </View>
            ) : null}
            {league.rewards?.trim() ? (
              <Text className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{league.rewards}</Text>
            ) : !league.prize_info?.trim() ? (
              <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Aucune récompense publiée pour cette ligue.</Text>
            ) : null}
          </ScrollView>
        )}
      </View>

      {/* CTA inscription — uniquement si inscriptions ouvertes */}
      {activeTab === 'Infos' && canRegister && (
        <View className="px-5 pb-8 pt-3" style={{ backgroundColor: '#0D1F0D' }}>
          <Pressable
            onPress={() => router.push(`/league/${id}/inscription`)}
            className="h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: '#F7921E' }}
          >
            <Text className="text-white font-bold text-base">Inscrire mon équipe</Text>
          </Pressable>
        </View>
      )}
    </ScreenBackground>
  );
}
