import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Image, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { apiClient } from '../../lib/api';
import { getCached, invalidateCached } from '../../lib/api-cache';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AutoImage } from '../../components/ui/auto-image';
import { RemoteImage } from '../../components/ui/remote-image';
import { PatternedGreenHeader } from '../../components/ui/patterned-green-header';

interface Author { id: string; full_name: string | null; avatar_url: string | null }
export type ReactionType = 'goal' | 'fire' | 'clap' | 'strong';
export interface ReactionCounts { goal: number; fire: number; clap: number; strong: number }
export interface Post {
  id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: Author;
  team?: { id: string; name: string } | null;
  liked_by_me: boolean;
  reactions?: ReactionCounts;
  my_reactions?: string[];
}

// Ordre + emoji des réactions (⚽ 🔥 👏 💪).
export const REACTIONS: { key: ReactionType; emoji: string }[] = [
  { key: 'goal', emoji: '⚽' },
  { key: 'fire', emoji: '🔥' },
  { key: 'clap', emoji: '👏' },
  { key: 'strong', emoji: '💪' },
];

export function initials(name?: string | null) {
  return (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
export function fmtRel(iso: string) {
  const d = Date.now() - +new Date(iso);
  const m = Math.round(d / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

function isOfficial(post: Post) {
  return (post.author.full_name ?? '').trim().toUpperCase() === 'GBONHI FOOT';
}

const TABS = ['Tout', 'Mon équipe', 'Leagues', 'Terrains'] as const;
type Tab = (typeof TABS)[number];

export function PostCard({ post, onPress, onReact }: { post: Post; onPress?: () => void; onReact?: (type: ReactionType) => void }) {
  const official = isOfficial(post);
  const counts = post.reactions ?? { goal: post.likes_count ?? 0, fire: 0, clap: 0, strong: 0 };
  const mine = post.my_reactions ?? [];
  return (
    <Pressable
      onPress={onPress}
      className="rounded-card p-4 mb-3"
      style={{
        backgroundColor: official ? 'rgba(247,146,30,0.06)' : 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: official ? 'rgba(247,146,30,0.5)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <View className="flex-row items-center gap-3 mb-2">
        {/* Avatar */}
        {post.author.avatar_url ? (
          <RemoteImage uri={post.author.avatar_url} style={{ width: 40, height: 40, borderRadius: 20 }} />
        ) : (
          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: official ? '#0D1F0D' : '#1E7A3A', borderWidth: official ? 2 : 0, borderColor: '#FFB830' }}>
            <Text className="text-white text-xs font-bold">{initials(post.author.full_name)}</Text>
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-white font-bold text-sm" numberOfLines={1}>{post.author.full_name ?? 'Joueur'}</Text>
            {official ? (
              <View className="px-2 py-0.5 rounded" style={{ backgroundColor: '#F7921E' }}>
                <Text className="text-white text-[10px] font-black">OFFICIEL</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-white/40 text-xs mt-0.5">
            {post.team ? `${post.team.name} · ` : ''}{fmtRel(post.created_at)}
          </Text>
        </View>
      </View>

      <Text className="text-white/90 text-sm leading-5">{post.content}</Text>
      {post.image_url ? <AutoImage uri={post.image_url} marginTop={10} /> : null}

      <View className="flex-row items-center mt-3">
        {REACTIONS.map((r) => {
          const active = mine.includes(r.key);
          return (
            <Pressable
              key={r.key}
              onPress={() => onReact?.(r.key)}
              hitSlop={6}
              className="flex-row items-center gap-1 mr-3 px-2 py-1 rounded-full"
              style={{ backgroundColor: active ? 'rgba(247,146,30,0.15)' : 'transparent', borderWidth: active ? 1 : 0, borderColor: 'rgba(247,146,30,0.4)' }}
            >
              <Text style={{ fontSize: 15 }}>{r.emoji}</Text>
              <Text className="text-sm" style={{ color: active ? '#F7921E' : 'rgba(255,255,255,0.7)' }}>{counts[r.key]}</Text>
            </Pressable>
          );
        })}
        <View className="flex-1" />
        <View className="flex-row items-center gap-1.5">
          <Text style={{ fontSize: 15 }}>💬</Text>
          <Text className="text-white/70 text-sm">{post.comments_count}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Tout');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      const [postsData, summary] = await Promise.all([
        getCached<Post[]>('/api/v1/community/posts', 15_000, force),
        getCached<{ teams?: { id: string }[] }>('/api/v1/users/me/summary', 20_000, force).catch(() => null),
      ]);
      setPosts(Array.isArray(postsData) ? postsData : []);
      setMyTeamId(summary?.teams?.[0]?.id ?? null);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recharge le fil à chaque fois que l'écran redevient actif (ex. retour de
  // l'écran « Créer un post ») pour voir immédiatement la nouvelle publication.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function react(p: Post, type: ReactionType) {
    // Mise à jour optimiste : une publication ne peut porter qu'une réaction
    // de l'utilisateur. Un nouveau choix remplace donc l'ancien.
    setPosts((ps) => ps.map((x) => {
      if (x.id !== p.id) return x;
      const counts: ReactionCounts = { goal: 0, fire: 0, clap: 0, strong: 0, ...(x.reactions ?? {}) };
      const mine = new Set(x.my_reactions ?? []);
      if (mine.has(type)) {
        mine.delete(type);
        counts[type] = Math.max(0, counts[type] - 1);
      } else {
        for (const previous of mine) counts[previous as ReactionType] = Math.max(0, counts[previous as ReactionType] - 1);
        mine.clear();
        mine.add(type);
        counts[type] += 1;
      }
      return { ...x, reactions: counts, my_reactions: [...mine] };
    }));
    try {
      await apiClient.post(`/api/v1/community/posts/${p.id}/react`, { type });
      invalidateCached('/api/v1/community/posts');
    } catch {
      load();
    }
  }

  const visible = useMemo(() => {
    if (tab === 'Tout') return posts;
    if (tab === 'Mon équipe') return posts.filter((p) => myTeamId && p.team?.id === myTeamId);
    return []; // Leagues / Terrains : catégorisation à venir côté backend
  }, [posts, tab, myTeamId]);

  return (
    <ScreenBackground>
      {/* Header vert à motifs triangulaires (maquette s27) */}
      <PatternedGreenHeader
        style={{ paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' }}
        patternOpacity={0.5}
      >
        <Text className="text-white font-black text-2xl text-center">Communauté</Text>
      </PatternedGreenHeader>

      {/* Filtres — conteneur à hauteur fixe : la barre ne peut pas être rognée
          ni chevauchée par la liste qui suit. */}
      <View style={{ height: 64, justifyContent: 'center' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 16, alignItems: 'center' }}
        >
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className="h-11 rounded-full items-center justify-center px-6"
                style={{ backgroundColor: active ? '#1E7A3A' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: active ? '#1E7A3A' : 'rgba(255,255,255,0.15)' }}
              >
                <Text className="text-sm font-bold" style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#F7921E" />}
          ListEmptyComponent={
            <View className="items-center py-24 px-8">
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
              <Text className="text-white/50 text-center">
                {tab === 'Leagues' || tab === 'Terrains'
                  ? 'Catégorie bientôt disponible.'
                  : tab === 'Mon équipe'
                    ? 'Aucune publication de ton équipe pour le moment.'
                    : 'Aucune publication pour le moment. Sois le premier à publier !'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard post={item} onPress={() => router.push(`/community/${item.id}`)} onReact={(t) => react(item, t)} />
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/community/create')}
        accessibilityLabel="Créer une publication"
        style={{ position: 'absolute', right: 20, bottom: 84, width: 60, height: 60, borderRadius: 30, backgroundColor: '#F7921E', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
      >
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 }}>+</Text>
      </Pressable>
    </ScreenBackground>
  );
}
