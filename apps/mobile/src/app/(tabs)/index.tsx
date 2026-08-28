import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUserModeStore } from '../../store/user-mode.store';
import { useAuthStore } from '../../store/auth.store';
import { getCached } from '../../lib/api-cache';
import { supabase } from '../../lib/supabase';
import { imageThumb } from '../../lib/image';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AppHeader, HeaderAction } from '../../components/ui/app-header';
import { RemoteImage } from '../../components/ui/remote-image';
import {
  type Match,
  formatMatchDate,
  formatMatchTime,
  teamInitials,
  teamColor,
} from '../../types/match';

/* ---------- types résumé perso ---------- */

interface SummaryTeam { id: string; name: string; logo_url?: string | null; primary_color?: string | null }
interface SummaryLeague { id: string; name: string; status: string }
interface Summary {
  teams: SummaryTeam[];
  upcomingMatches: Match[];
  leagues: SummaryLeague[];
  stats: { goals: number; assists: number; teamsCount: number };
  unreadNotifications: number;
}

/* ---------- helpers UI ---------- */

function Avatar({ initials, color, size = 40 }: { initials: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} className="items-center justify-center">
      <Text className="text-white text-xs font-bold">{initials}</Text>
    </View>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-white text-xl font-black">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-accent text-sm font-semibold">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View className="rounded-card p-4" style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, style]}>
      {children}
    </View>
  );
}

function EmptyState({ text, cta, onPress }: { text: string; cta?: string; onPress?: () => void }) {
  return (
    <Card>
      <Text className="text-white/55 text-sm text-center py-1">{text}</Text>
      {cta ? (
        <Pressable onPress={onPress} className="mt-3 self-center">
          <Text className="text-accent text-sm font-bold">{cta}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function isSameDay(iso: string, ref: Date) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

/* ---------- Mode Leagues (dynamique, données du compte connecté) ---------- */

function HomeLeagues({ summary, matches, loading }: { summary: Summary | null; matches: Match[]; loading: boolean }) {
  const router = useRouter();
  const today = matches.filter((m) => isSameDay(m.scheduled_at, new Date()));
  const live = matches.filter((m) => m.status === 'EN_COURS');
  const nextMatch = summary?.upcomingMatches?.[0] ?? null;
  const hasTeam = (summary?.stats.teamsCount ?? 0) > 0;

  if (loading) {
    return <View className="mt-8 items-center"><ActivityIndicator color="#F7921E" /></View>;
  }

  return (
    <>
      {/* Matches du jour (activité réelle des ligues) */}
      <View className="mt-5 px-4">
        <SectionHeader title="Matchs du jour" action="Voir tout →" onAction={() => router.push('/match')} />
        {today.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {today.map((m) => (
              <Pressable key={m.id} onPress={() => router.push(`/match/${m.id}`)} className="active:opacity-90">
                <Card style={{ width: 250 }}>
                  <View className="flex-row items-center gap-3">
                    <Avatar initials={teamInitials(m.home_team.name)} color={teamColor(m.home_team)} size={32} />
                    <Text className="text-white text-base font-bold flex-1" numberOfLines={1}>{m.home_team.name}</Text>
                  </View>
                  <Text className="text-accent text-lg font-black text-center my-1">{formatMatchTime(m.scheduled_at)}</Text>
                  <View className="flex-row items-center gap-3">
                    <Avatar initials={teamInitials(m.away_team.name)} color={teamColor(m.away_team)} size={32} />
                    <Text className="text-white text-base font-bold flex-1" numberOfLines={1}>{m.away_team.name}</Text>
                  </View>
                  {m.venue ? <Text className="text-white/45 text-xs mt-2" numberOfLines={1}>{m.venue}</Text> : null}
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <EmptyState text="Aucun match programmé aujourd'hui." />
        )}
      </View>

      {/* EN DIRECT */}
      {live.length > 0 ? (
        <View className="mt-6 px-4">
          {live.map((m) => (
            <Pressable key={m.id} onPress={() => router.push(`/match/${m.id}`)} className="rounded-card p-4 mb-3 active:opacity-90"
              style={{ backgroundColor: 'rgba(211,47,47,0.08)', borderWidth: 1, borderColor: 'rgba(211,47,47,0.5)' }}>
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E53935' }} />
                <Text style={{ color: '#E53935' }} className="text-xs font-black tracking-widest">EN DIRECT</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1">
                  <Avatar initials={teamInitials(m.home_team.name)} color={teamColor(m.home_team)} />
                  <Text className="text-white text-base font-bold flex-1" numberOfLines={1}>{m.home_team.name}</Text>
                </View>
                <Text className="text-white text-3xl font-black mx-2">{m.home_score} : {m.away_score}</Text>
                <View className="flex-row items-center gap-2 flex-1 justify-end">
                  <Text className="text-white text-base font-bold flex-1 text-right" numberOfLines={1}>{m.away_team.name}</Text>
                  <Avatar initials={teamInitials(m.away_team.name)} color={teamColor(m.away_team)} />
                </View>
              </View>
              <Text className="text-accent text-sm font-bold text-center mt-3">Voir le match →</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Mon prochain match (du joueur connecté) */}
      <View className="mt-6 px-4">
        <Text className="text-white text-xl font-black mb-3">Mon prochain match</Text>
        {nextMatch ? (
          <Pressable onPress={() => router.push(`/match/${nextMatch.id}`)} className="active:opacity-90">
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="w-14 h-14 rounded-xl items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
                  <Text className="text-white text-lg font-black">{new Date(nextMatch.scheduled_at).getDate()}</Text>
                  <Text className="text-white text-[10px] font-bold uppercase">
                    {new Date(nextMatch.scheduled_at).toLocaleDateString('fr-FR', { month: 'short' })}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white text-base font-bold" numberOfLines={1}>
                    {nextMatch.home_team.name} vs {nextMatch.away_team.name}
                  </Text>
                  <Text className="text-white/50 text-sm mt-0.5" numberOfLines={1}>
                    {formatMatchDate(nextMatch.scheduled_at)} · {formatMatchTime(nextMatch.scheduled_at)}{nextMatch.venue ? ` · ${nextMatch.venue}` : ''}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ) : (
          <EmptyState text="Tu n'as pas encore de match programmé." cta="Rejoindre une ligue →" onPress={() => router.push('/league')} />
        )}
      </View>

      {/* Mes ligues */}
      <View className="mt-6 px-4">
        <SectionHeader title="Mes ligues" action={summary?.leagues.length ? 'Voir tout →' : undefined} onAction={() => router.push('/league')} />
        {summary && summary.leagues.length > 0 ? (
          <View className="gap-2">
            {summary.leagues.map((l) => (
              <Pressable key={l.id} onPress={() => router.push(`/league/${l.id}`)} className="active:opacity-90">
                <Card>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white text-base font-bold flex-1" numberOfLines={1}>{l.name}</Text>
                    <Text className="text-white/45 text-xs">{l.status}</Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState text="Tu ne participes à aucune ligue pour l'instant." cta="Découvrir les ligues →" onPress={() => router.push('/league')} />
        )}
      </View>

      {/* Mon résumé (stats réelles du joueur) */}
      <View className="mt-6 px-4">
        <Text className="text-white text-xl font-black mb-3">Mon résumé</Text>
        {hasTeam ? (
          <View className="flex-row gap-3">
            {[
              { top: String(summary?.stats.goals ?? 0), label: 'Buts', sub: 'saison', hl: true },
              { top: String(summary?.stats.assists ?? 0), label: 'Passes', sub: 'déc.', hl: false },
              { top: String(summary?.stats.teamsCount ?? 0), label: 'Équipe', sub: summary && summary.stats.teamsCount > 1 ? 's' : '', hl: false },
            ].map((s, i) => (
              <View key={i} className="flex-1 rounded-card p-3 items-center"
                style={{ backgroundColor: s.hl ? 'rgba(247,146,30,0.12)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: s.hl ? '#F7921E' : 'rgba(255,255,255,0.08)' }}>
                <Text className={`text-lg font-black ${s.hl ? 'text-accent' : 'text-white'}`}>{s.top}</Text>
                <Text className="text-white/70 text-[11px] mt-1 text-center">{s.label}</Text>
                <Text className="text-white/40 text-[11px] text-center">{s.sub}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text="Tes statistiques apparaîtront dès que tu rejoins une équipe." />
        )}
      </View>

      {/* Communauté (endpoint à venir — Phase 5) */}
      <View className="mt-6 px-4">
        <SectionHeader title="Communauté" action="Voir tout →" onAction={() => router.push('/community')} />
        <EmptyState text="Rejoins les discussions de la communauté." cta="Ouvrir la communauté →" onPress={() => router.push('/community')} />
      </View>
    </>
  );
}

/* ---------- Mode Réservation (s09) ---------- */

interface Terrain {
  id: string;
  name: string;
  city?: string | null;
  surface?: string | null;
  format?: string | null;
  price_per_hour?: number | null;
  rating_avg?: number | null;
  photos?: string[] | null;
}
interface MyReservation {
  id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  status?: string | null;
  terrain?: { name?: string | null; surface?: string | null } | null;
}
interface FeedPost { id: string; content: string; created_at: string; author: { full_name: string | null } }

const SURFACE_FR: Record<string, string> = { grass: 'Gazon', artificial: 'Synthétique', futsal: 'Futsal' };
const RES_FILTERS: { key: string; label: string; kind: 'all' | 'surface' | 'format' }[] = [
  { key: 'all', label: 'Tous', kind: 'all' },
  { key: 'grass', label: 'Gazon', kind: 'surface' },
  { key: 'artificial', label: 'Synthétique', kind: 'surface' },
  { key: 'futsal', label: 'Futsal', kind: 'surface' },
  { key: '5vs5', label: '5vs5', kind: 'format' },
  { key: '7vs7', label: '7v7', kind: 'format' },
];
const MONTHS_FR = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];

function resStatusMeta(s?: string | null) {
  const u = (s ?? '').toUpperCase();
  if (/CONFIRM|VALID/.test(u)) return { label: 'Confirmé', color: '#2E9E4F' };
  if (/CANCEL|ANNUL|REFUS/.test(u)) return { label: 'Annulé', color: '#DC2626' };
  return { label: 'En attente', color: '#F7921E' };
}

function HomeReservation() {
  const router = useRouter();
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [reservations, setReservations] = useState<MyReservation[]>([]);
  const [latestPost, setLatestPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Réservations rechargées à chaque retour sur l'accueil (force = ignore le
  // cache) : une réservation qui vient d'être validée apparaît immédiatement.
  const loadReservations = useCallback((force = false) => {
    return getCached<MyReservation[]>('/api/v1/reservations/mine', 20_000, force)
      .then((data) => setReservations(Array.isArray(data) ? data : []))
      .catch(() => { /* on garde l'affichage précédent en cas d'erreur réseau */ });
  }, []);

  useEffect(() => {
    let mounted = true;
    // Chaque section devient visible dès que SA donnée arrive : on ne bloque
    // plus l'accueil entier sur le fil communautaire ou les réservations.
    void getCached<Terrain[]>('/api/v1/terrains', 60_000)
      .then((data) => { if (mounted) setTerrains(Array.isArray(data) ? data : []); })
      .catch(() => { if (mounted) setTerrains([]); })
      .finally(() => { if (mounted) setLoading(false); });
    void loadReservations();
    void getCached<FeedPost[]>('/api/v1/community/posts?limit=1', 20_000)
      .then((data) => { if (mounted) setLatestPost(Array.isArray(data) && data.length > 0 ? data[0] : null); })
      .catch(() => { if (mounted) setLatestPost(null); });
    return () => { mounted = false; };
  }, [loadReservations]);

  useFocusEffect(useCallback(() => { void loadReservations(true); }, [loadReservations]));

  const visible = terrains.filter((terrain) => {
    const selectedFilter = RES_FILTERS.find((item) => item.key === filter);
    if (!selectedFilter || selectedFilter.kind === 'all') return true;
    return selectedFilter.kind === 'surface'
      ? terrain.surface === selectedFilter.key
      : terrain.format === selectedFilter.key;
  });

  const upcoming = reservations.filter((r) => {
    if ((r.status ?? '').toLowerCase() === 'cancelled') return false;
    const d = new Date(r.reservation_date);
    return !Number.isNaN(d.getTime()) && d.getTime() >= Date.now() - 12 * 3600e3;
  });

  return (
    <>
      {/* Hero — Trouve ton terrain */}
      <View className="px-4 mt-5">
        <View className="rounded-card overflow-hidden" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0F3D1E' }}>
          {terrains[0]?.photos?.[0] ? (
            <RemoteImage
              uri={imageThumb(terrains[0].photos![0], 800)}
              contentFit="cover"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          ) : null}
          <View className="p-5" style={{ backgroundColor: 'rgba(13,31,13,0.62)' }}>
            <Text className="text-white text-2xl font-black">Trouve ton terrain 🏟️</Text>
            <Text className="text-white/75 text-sm mt-1">Dispo près de chez toi, dès maintenant</Text>
            <Pressable
              onPress={() => router.push('/terrain')}
              className="h-11 rounded-btn items-center justify-center mt-4 active:opacity-90"
              style={{ backgroundColor: '#F7921E', alignSelf: 'flex-start', paddingHorizontal: 22 }}
            >
              <Text className="text-white font-bold text-base">Réserver maintenant</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }} className="mt-4 flex-grow-0">
        {RES_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className="h-10 rounded-full items-center justify-center px-5"
              style={{ backgroundColor: active ? 'rgba(46,158,79,0.28)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: active ? '#2E9E4F' : 'rgba(255,255,255,0.15)' }}
            >
              <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Terrains (horizontal) */}
      <View className="mt-4">
        {loading ? (
          <View className="items-center py-4"><ActivityIndicator color="#F7921E" /></View>
        ) : visible.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {visible.slice(0, 10).map((t) => (
              <Pressable key={t.id} onPress={() => router.push(`/terrain/${t.id}`)} className="rounded-card overflow-hidden active:opacity-90" style={{ width: 260, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ height: 130, backgroundColor: '#0F3D1E' }}>
                  {t.photos?.[0] ? (
                    <RemoteImage
                      uri={imageThumb(t.photos[0], 600)}
                      contentFit="cover"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                  <View className="flex-row items-center gap-1 rounded-lg px-2 py-1" style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <Text style={{ color: '#FFB830', fontSize: 12 }}>★</Text>
                    <Text className="text-white text-xs font-bold">{(t.rating_avg ?? 0).toFixed(1)}</Text>
                  </View>
                </View>
                <View className="p-3">
                  <Text className="text-white text-base font-bold" numberOfLines={1}>{t.name}</Text>
                  <Text className="text-white/50 text-sm mt-0.5" numberOfLines={1}>{[t.city, t.surface ? SURFACE_FR[t.surface] ?? t.surface : null].filter(Boolean).join(' · ')}</Text>
                  {t.price_per_hour ? (
                    <Text className="text-accent text-base font-black mt-1">{t.price_per_hour.toLocaleString('fr-FR')} FCFA <Text className="text-white/50 text-xs font-normal">/h</Text></Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View className="px-4"><EmptyState text="Aucun terrain pour ce filtre." /></View>
        )}
      </View>

      {/* Mes réservations à venir */}
      <View className="mt-6 px-4">
        <Text className="text-white text-xl font-black mb-3">Mes réservations à venir</Text>
        {upcoming.length > 0 ? (
          <View className="gap-3">
            {upcoming.map((r) => {
              const d = new Date(r.reservation_date);
              const meta = resStatusMeta(r.status);
              return (
                <Card key={r.id}>
                  <View className="flex-row items-center gap-3">
                    <View className="w-14 h-14 rounded-xl items-center justify-center" style={{ backgroundColor: '#F7921E' }}>
                      <Text className="text-white text-lg font-black">{d.getDate()}</Text>
                      <Text className="text-white text-[10px] font-bold">{MONTHS_FR[d.getMonth()]}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-base font-bold" numberOfLines={1}>{r.terrain?.name ?? 'Terrain'}</Text>
                      <Text className="text-white/50 text-sm mt-0.5">{r.start_hour}h00 – {r.end_hour}h00{r.terrain?.surface ? ` · ${SURFACE_FR[r.terrain.surface] ?? r.terrain.surface}` : ''}</Text>
                    </View>
                    <Text style={{ color: meta.color }} className="text-sm font-bold">{meta.label}</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState text="Tu n'as pas encore de réservation." cta="Réserver un terrain →" onPress={() => router.push('/terrain')} />
        )}
      </View>

      {/* Communauté */}
      <View className="mt-6 px-4">
        <SectionHeader title="Communauté" action="Voir tout →" onAction={() => router.push('/community')} />
        {latestPost ? (
          <Pressable onPress={() => router.push(`/community/${latestPost.id}`)} className="active:opacity-90">
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
                  <Text className="text-white text-xs font-bold">{(latestPost.author.full_name ?? '?').slice(0, 2).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white text-sm font-bold">{latestPost.author.full_name ?? 'Joueur'}</Text>
                  <Text className="text-white/60 text-sm mt-0.5" numberOfLines={1}>{latestPost.content}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ) : (
          <EmptyState text="Rejoins les discussions de la communauté." cta="Ouvrir la communauté →" onPress={() => router.push('/community')} />
        )}
      </View>
    </>
  );
}

/* ---------- Écran ---------- */

export default function HomeScreen() {
  const router = useRouter();
  const { mode, clearMode } = useUserModeStore();
  const { user } = useAuthStore();
  const firstName = ((user?.user_metadata?.full_name as string | undefined) ?? '').trim().split(/\s+/)[0] ?? '';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    // La synthèse utilisateur est prioritaire pour le contenu du dashboard ;
    // les matchs s'ajoutent dès leur disponibilité, sans écran bloqué.
    const [summaryResult, matchesResult] = await Promise.allSettled([
      getCached<Summary>('/api/v1/users/me/summary', 20_000, force),
      getCached<Match[]>('/api/v1/matches', 15_000, force),
    ]);
    setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null);
    setMatches(matchesResult.status === 'fulfilled' && Array.isArray(matchesResult.value) ? matchesResult.value : []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refetch (en contournant le cache) à chaque retour sur l'accueil.
  useFocusEffect(useCallback(() => { void load(true); }, [load]));

  // Temps réel : au coup d'envoi / fin d'un match, l'accueil se met à jour
  // automatiquement (Matchs du jour, EN DIRECT) sans rechargement manuel.
  useEffect(() => {
    const channel = supabase
      .channel('home-matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => { void load(true); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return (
    <ScreenBackground>
      <AppHeader
        title={`Bonjour ${firstName}${firstName ? ' ' : ''}👋`}
        subtitle="Le football amateur commence ici."
        onBack={() => {
          void clearMode();
          router.replace('/(auth)/mode-selection');
        }}
        showLogo
        actions={
          <HeaderAction label="Notifications" onPress={() => router.push('/notifications')} badge={!!summary && summary.unreadNotifications > 0}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </HeaderAction>
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#F7921E" />}
      >
        {mode === 'reservation' ? <HomeReservation /> : <HomeLeagues summary={summary} matches={matches} loading={loading} />}
      </ScrollView>

      {/* Bouton flottant — créer une publication (mode leagues), comme la maquette */}
      {mode !== 'reservation' && (
        <Pressable
          onPress={() => router.push('/community/create')}
          accessibilityLabel="Créer une publication"
          style={{ position: 'absolute', right: 20, bottom: 84, width: 60, height: 60, borderRadius: 30, backgroundColor: '#F7921E', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 }}>+</Text>
        </Pressable>
      )}
    </ScreenBackground>
  );
}
