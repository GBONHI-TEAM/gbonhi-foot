import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenBackground } from '../components/ui/screen-background';
import { AppHeader } from '../components/ui/app-header';
import { apiClient } from '../lib/api';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown> | null;
}

// Emoji + couleur de la tuile par type de notification.
const ICON_META: Record<string, { e: string; bg: string }> = {
  match_scheduled: { e: '⏰', bg: '#F7921E' },
  match_result: { e: '🏆', bg: 'rgba(255,255,255,0.08)' },
  team_join_request: { e: '👥', bg: '#1E7A3A' },
  team_join_approved: { e: '✅', bg: '#2E9E4F' },
  team_join_rejected: { e: '🚫', bg: 'rgba(248,113,113,0.2)' },
  league_registration: { e: '🏆', bg: '#1E7A3A' },
  league_status: { e: '🏆', bg: 'rgba(255,255,255,0.08)' },
  community_like: { e: '🔥', bg: 'rgba(255,255,255,0.08)' },
  community_comment: { e: '💬', bg: 'rgba(255,255,255,0.08)' },
  support_update: { e: '🛟', bg: '#1E7A3A' },
  info: { e: '🔔', bg: 'rgba(30,122,58,0.25)' },
};

const FILTERS = ['Tout', 'Matchs', 'Réservations', 'Communauté'] as const;
type Filter = (typeof FILTERS)[number];

function inFilter(type: string, f: Filter): boolean {
  if (f === 'Tout') return true;
  if (f === 'Matchs') return type.startsWith('match_');
  if (f === 'Réservations') return type.startsWith('reservation');
  if (f === 'Communauté') return type.startsWith('community_');
  return true;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function bucketOf(iso: string): 'Aujourd\'hui' | 'Cette semaine' | 'Plus ancien' {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'Aujourd\'hui';
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 7) return 'Cette semaine';
  return 'Plus ancien';
}
const BUCKET_LABELS: Record<string, string> = { 'Aujourd\'hui': 'AUJOURD\'HUI', 'Cette semaine': 'CETTE SEMAINE', 'Plus ancien': 'PLUS ANCIEN' };

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<Filter>('Tout');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Notif[]>('/api/v1/notifications');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const unread = items.filter((n) => !n.read).length;

  // Filtrage + regroupement par période.
  const groups = useMemo(() => {
    const filtered = items.filter((n) => inFilter(n.type, filter));
    const order = ['Aujourd\'hui', 'Cette semaine', 'Plus ancien'] as const;
    return order
      .map((b) => ({ bucket: b, list: filtered.filter((n) => bucketOf(n.created_at) === b) }))
      .filter((g) => g.list.length > 0);
  }, [items, filter]);

  async function markAllRead() {
    if (unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try { await apiClient.patch('/api/v1/notifications/read-all'); } catch { /* best-effort */ }
  }

  async function openNotif(n: Notif) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      try { await apiClient.patch(`/api/v1/notifications/${n.id}/read`); } catch { /* best-effort */ }
    }
    const d = n.data ?? {};
    if (d.ticket_id) router.push('/support');
    else if (d.team_id) router.push('/team');
    else if (d.league_id) router.push(`/league/${d.league_id}`);
  }

  return (
    <ScreenBackground>
      <AppHeader
        title="Notifications"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        actions={
          unread > 0 ? (
            <Pressable onPress={markAllRead} accessibilityLabel="Tout lire" style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Tout lire</Text>
            </Pressable>
          ) : null
        }
      />

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }} className="mt-4 flex-grow-0">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} className="h-11 rounded-full items-center justify-center px-6" style={{ backgroundColor: active ? '#1E7A3A' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: active ? '#1E7A3A' : 'rgba(255,255,255,0.15)' }}>
              <Text className="text-sm font-bold" style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      ) : groups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🔔</Text>
          <Text className="text-white font-black text-xl text-center mb-2">Aucune notification</Text>
          <Text className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {filter === 'Tout'
              ? 'Tu seras prévenu ici pour tes équipes, tes matchs, tes ligues et la communauté.'
              : 'Aucune notification dans cette catégorie.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#F7921E" />}
        >
          {groups.map((g) => (
            <View key={g.bucket}>
              <Text className="text-xs font-bold tracking-widest mt-2 mb-2.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{BUCKET_LABELS[g.bucket]}</Text>
              {g.list.map((n) => {
                const meta = ICON_META[n.type] ?? ICON_META.info;
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => openNotif(n)}
                    className="flex-row gap-3 rounded-2xl p-4 mb-2.5"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: n.read ? 'rgba(255,255,255,0.07)' : 'rgba(46,158,79,0.35)' }}
                  >
                    <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: meta.bg }}>
                      <Text style={{ fontSize: 18 }}>{meta.e}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-start">
                        <Text className="flex-1 text-white font-bold text-[15px]" numberOfLines={2}>{n.title}</Text>
                        {!n.read ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#4ADE80', marginLeft: 8, marginTop: 5 }} /> : null}
                      </View>
                      {n.body ? <Text className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{n.body}</Text> : null}
                      <Text className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{timeAgo(n.created_at)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenBackground>
  );
}
