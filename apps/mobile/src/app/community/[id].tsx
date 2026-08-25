import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient, postShareLink } from '../../lib/api';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AutoImage } from '../../components/ui/auto-image';
import { RemoteImage } from '../../components/ui/remote-image';
import { AppHeader, HeaderAction } from '../../components/ui/app-header';
import { useAuthStore } from '../../store/auth.store';
import { initials, fmtRel, REACTIONS, type Post, type ReactionType, type ReactionCounts } from '../(tabs)/community';

interface Comment { id: string; content: string; created_at: string; author: { id: string; full_name: string | null } }
interface PostDetail extends Post { comments: Comment[] }

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isMine = !!post && !!user?.id && post.author.id === user.id;

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<PostDetail>(`/api/v1/community/posts/${id}`);
      setPost(data);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function react(type: ReactionType) {
    if (!post) return;
    const counts: ReactionCounts = { goal: 0, fire: 0, clap: 0, strong: 0, ...(post.reactions ?? {}) };
    const mine = new Set(post.my_reactions ?? []);
    if (mine.has(type)) { mine.delete(type); counts[type] = Math.max(0, counts[type] - 1); }
    else { mine.add(type); counts[type] = counts[type] + 1; }
    setPost({ ...post, reactions: counts, my_reactions: [...mine] });
    try { await apiClient.post(`/api/v1/community/posts/${id}/react`, { type }); } catch { load(); }
  }

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiClient.post(`/api/v1/community/posts/${id}/comments`, { content: text.trim() });
      setText('');
      Keyboard.dismiss();
      await load();
      // Retour visuel : on descend jusqu'au commentaire qui vient d'être ajouté
      // pour que l'utilisateur voie que son message est bien parti.
      requestAnimationFrame(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      });
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  }

  async function report() {
    if (!post) return;
    try {
      await apiClient.post('/api/v1/support/tickets', {
        kind: 'incident',
        category: 'Communauté',
        subject: 'Signalement d\'une publication',
        message: `Publication signalée de ${post.author.full_name ?? 'un utilisateur'} :\n\n"${post.content.slice(0, 500)}"`,
      });
      Alert.alert('Merci', 'Le signalement a été transmis à la modération.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le signalement. Réessaie.');
    }
  }

  function remove() {
    Alert.alert('Supprimer', 'Supprimer cette publication ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await apiClient.delete(`/api/v1/community/posts/${id}`);
            router.back();
          } catch { Alert.alert('Erreur', 'Suppression impossible.'); }
        },
      },
    ]);
  }

  function openMenu() {
    const options = isMine
      ? [{ text: 'Supprimer la publication', style: 'destructive' as const, onPress: remove }, { text: 'Annuler', style: 'cancel' as const }]
      : [{ text: 'Signaler la publication', onPress: report }, { text: 'Annuler', style: 'cancel' as const }];
    Alert.alert('Publication', undefined, options);
  }

  async function sharePost() {
    if (!post) return;
    const author = post.author.full_name ?? 'Un joueur';
    const message = `${author} sur GBONHI FOOT ⚽\n\n"${post.content}"\n\nVoir la publication sur GBONHI FOOT 👇\n${postShareLink(post.id)}`;
    try {
      // Menu de partage natif : l'utilisateur choisit l'app (WhatsApp, SMS, etc.).
      await Share.share({ message });
    } catch {
      /* partage annulé par l'utilisateur */
    }
  }

  return (
    <ScreenBackground>
      <AppHeader
        title="Publication"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community'))}
        actions={
          <HeaderAction label="Options" onPress={openMenu}>
            <Text style={{ color: '#fff', fontSize: 20, marginTop: -6 }}>⋯</Text>
          </HeaderAction>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {loading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
        ) : !post ? (
          <View className="flex-1 items-center justify-center"><Text className="text-white/50">Publication introuvable.</Text></View>
        ) : (
          <>
            <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
              {/* Post */}
              <View className="mb-4">
                <View className="flex-row items-start gap-3 mb-3">
                  {post.author.avatar_url ? (
                    <RemoteImage uri={post.author.avatar_url} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
                      <Text className="text-white text-sm font-bold">{initials(post.author.full_name)}</Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-white font-bold text-base">{post.author.full_name ?? 'Joueur'}</Text>
                    <Text className="text-white/40 text-xs mt-0.5">{post.team ? `${post.team.name} · ` : ''}{fmtRel(post.created_at)}</Text>
                  </View>
                  {!isMine ? (
                    <Pressable onPress={report} className="flex-row items-center gap-1 px-3 py-1.5 rounded-full" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Text style={{ fontSize: 11 }}>🚩</Text>
                      <Text className="text-white/60 text-xs font-semibold">Signaler</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text className="text-white/90 text-[15px] leading-6">{post.content}</Text>
                {post.image_url ? <AutoImage uri={post.image_url} marginTop={12} /> : null}

                {/* Réactions en pilules */}
                <View className="flex-row flex-wrap gap-2.5 mt-4">
                  {REACTIONS.map((r) => {
                    const counts: ReactionCounts = { goal: 0, fire: 0, clap: 0, strong: 0, ...(post.reactions ?? {}) };
                    const active = (post.my_reactions ?? []).includes(r.key);
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => react(r.key)}
                        className="flex-row items-center gap-1.5 px-4 py-2 rounded-full"
                        style={{
                          backgroundColor: active ? 'rgba(247,146,30,0.15)' : 'rgba(255,255,255,0.05)',
                          borderWidth: 1,
                          borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.12)',
                        }}
                      >
                        <Text style={{ fontSize: 15 }}>{r.emoji}</Text>
                        <Text className="text-sm font-semibold" style={{ color: active ? '#F7921E' : 'rgba(255,255,255,0.75)' }}>{counts[r.key]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="h-px mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

              {/* Commentaires */}
              <Text className="text-white font-black text-base mb-3">Commentaires · {post.comments_count}</Text>
              {post.comments.length === 0 ? (
                <Text className="text-white/40 text-sm py-4 text-center">Aucun commentaire. Lance la discussion !</Text>
              ) : (
                post.comments.map((c) => (
                  <View key={c.id} className="flex-row gap-3 mb-3">
                    <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: '#0F3D1E' }}>
                      <Text className="text-white text-[10px] font-bold">{initials(c.author.full_name)}</Text>
                    </View>
                    <View className="flex-1 rounded-2xl px-3.5 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Text className="text-white text-sm font-bold">{c.author.full_name ?? 'Joueur'} <Text className="text-white/40 font-normal text-xs">· {fmtRel(c.created_at)}</Text></Text>
                      <Text className="text-white/85 text-sm mt-1">{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Partager la publication (menu natif : WhatsApp, SMS, etc.) */}
            <View className="px-4 pt-2">
              <Pressable onPress={sharePost} className="h-14 rounded-btn flex-row items-center justify-center gap-2" style={{ backgroundColor: '#F7921E' }}>
                <Text style={{ fontSize: 18 }}>📤</Text>
                <Text className="text-white font-bold text-base">Partager la publication</Text>
              </Pressable>
            </View>

            {/* Barre d'ajout de commentaire */}
            <View className="flex-row items-center gap-2 px-4 py-3" style={{ borderTopColor: 'rgba(255,255,255,0.08)', borderTopWidth: 1 }}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Ajouter un commentaire…"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{ flex: 1, color: '#fff', fontSize: 15, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 }}
              />
              <Pressable onPress={send} disabled={sending || !text.trim()} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#F7921E', alignItems: 'center', justifyContent: 'center', opacity: sending || !text.trim() ? 0.5 : 1 }}>
                <Text style={{ color: '#fff', fontSize: 18 }}>➤</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
