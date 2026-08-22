import { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AppHeader } from '../../components/ui/app-header';
import { RemoteImage } from '../../components/ui/remote-image';
import { getCached } from '../../lib/api-cache';
import { imageThumb } from '../../lib/image';

interface ApiLeague {
  id: string;
  name: string;
  status: string;
  level?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  max_teams?: number | null;
  prize_info?: string | null;
  banner_url?: string | null;
  _count?: { teams: number; matches: number };
}

type Cat = 'en_cours' | 'a_venir' | 'terminee';
const FILTER_TABS: { label: string; cat: Cat | 'all' }[] = [
  { label: 'Toutes', cat: 'all' },
  { label: 'En cours', cat: 'en_cours' },
  { label: 'À venir', cat: 'a_venir' },
  { label: 'Terminées', cat: 'terminee' },
];
const MONTH_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function categoryOf(status: string): Cat {
  const u = (status ?? '').toUpperCase();
  if (u.startsWith('TERMIN') || u.includes('FINISH') || u === 'VALIDÉ') return 'terminee';
  if (u.includes('EN_COURS') || u.includes('ONGOING')) return 'en_cours';
  return 'a_venir';
}
const CAT_BADGE: Record<Cat, { label: string; bg: string }> = {
  en_cours: { label: 'EN COURS', bg: '#DC2626' },
  a_venir: { label: 'À VENIR', bg: '#F7921E' },
  terminee: { label: 'TERMINÉE', bg: '#374151' },
};
function fmtDay(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

function LeagueCard({ league }: { league: ApiLeague }) {
  const router = useRouter();
  const cat = categoryOf(league.status);
  const badge = CAT_BADGE[cat];
  const teams = league._count?.teams ?? 0;
  const max = league.max_teams ?? 0;
  const full = max > 0 && teams >= max;
  const spotsLeft = Math.max(max - teams, 0);
  const banner = imageThumb(league.banner_url, 800);

  return (
    <Pressable onPress={() => router.push(`/league/${league.id}`)} className="rounded-2xl overflow-hidden mb-4 active:opacity-90" style={{ backgroundColor: '#132913', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
      {/* Bannière + badge statut */}
      <View style={{ height: 140, backgroundColor: '#0F3D1E' }}>
        {banner ? <RemoteImage uri={banner} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
        <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: badge.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text className="font-black text-[11px] tracking-widest text-white">{badge.label}</Text>
        </View>
      </View>

      <View className="p-5">
        <Text className="text-white font-black text-lg leading-tight mb-2">{league.name}</Text>
        {league.level?.trim() ? (
          <View className="self-start px-2.5 py-0.5 rounded-full mb-3" style={{ backgroundColor: 'rgba(255,184,48,0.15)', borderWidth: 1, borderColor: 'rgba(255,184,48,0.4)' }}>
            <Text className="text-xs font-semibold" style={{ color: '#FFB830' }}>Niveau : {league.level}</Text>
          </View>
        ) : <View className="mb-1" />}

        {/* Dates / Équipes / Matchs */}
        <View className="flex-row gap-6 mb-3">
          <View>
            <Text className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Dates</Text>
            <Text className="text-white text-sm font-bold">{fmtDay(league.start_date)} – {fmtDay(league.end_date)}</Text>
          </View>
          <View>
            <Text className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Équipes</Text>
            <Text className="text-white text-sm font-bold">{teams}{max ? ` / ${max}` : ''}</Text>
          </View>
          <View>
            <Text className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Matchs</Text>
            <Text className="text-white text-sm font-bold">{league._count?.matches ?? 0}</Text>
          </View>
        </View>

        {/* Inscrits + places */}
        <View className="flex-row items-center gap-2 mb-3">
          <Text className="text-white/80 text-sm">🎟 {teams}{max ? ` / ${max}` : ''} inscrites</Text>
          {full ? (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(220,38,38,0.2)' }}>
              <Text className="text-xs font-bold" style={{ color: '#F87171' }}>COMPLET</Text>
            </View>
          ) : max ? (
            <Text className="text-sm" style={{ color: '#4ADE80' }}>— {spotsLeft} places restantes</Text>
          ) : null}
        </View>

        {/* Dotation + Détails */}
        <View className="flex-row items-center justify-between pt-3 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.08)' }}>
          <View>
            <Text className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Dotation</Text>
            <Text className="font-black text-base" style={{ color: '#F7921E' }}>{league.prize_info?.trim() || '—'}</Text>
          </View>
          <Text className="text-sm font-semibold" style={{ color: '#4ADE80' }}>Détails →</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function LeagueScreen() {
  const [leagues, setLeagues] = useState<ApiLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Cat | 'all'>('all');

  const load = useCallback(async (force = false) => {
    try {
      const data = await getCached<ApiLeague[]>('/api/v1/leagues', 30_000, force);
      setLeagues(Array.isArray(data) ? data : []);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recharge à chaque fois que l'onglet est affiché (données fraîches après une
  // modification faite dans le back-office).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = leagues.filter((l) => activeFilter === 'all' || categoryOf(l.status) === activeFilter);

  return (
    <ScreenBackground>
      <AppHeader title="Leagues" showLogo={false} centered />

      {/* Filtres */}
      <View className="px-4 pt-3 pb-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {FILTER_TABS.map((tab) => {
              const active = activeFilter === tab.cat;
              return (
                <Pressable key={tab.label} onPress={() => setActiveFilter(tab.cat)} className="px-4 py-2 rounded-full" style={{ backgroundColor: active ? '#1E7A3A' : 'rgba(255,255,255,0.07)' }}>
                  <Text className="text-sm font-semibold" style={{ color: active ? 'white' : 'rgba(255,255,255,0.55)' }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <LeagueCard league={item} />}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#F7921E" />}
          ListEmptyComponent={
            <View className="items-center py-24 px-8">
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🏆</Text>
              <Text className="text-white/50 text-center">{leagues.length === 0 ? 'Aucune ligue pour le moment.' : 'Aucune ligue dans cette catégorie.'}</Text>
            </View>
          }
        />
      )}
    </ScreenBackground>
  );
}
