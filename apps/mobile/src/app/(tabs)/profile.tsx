import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useUserModeStore } from '../../store/user-mode.store';
import { useAuthStore } from '../../store/auth.store';
import { apiClient } from '../../lib/api';
import { getCached, invalidateCached } from '../../lib/api-cache';
import { imageThumb } from '../../lib/image';
import { RemoteImage } from '../../components/ui/remote-image';
import { ScreenBackground } from '../../components/ui/screen-background';
import { PatternedGreenHeader } from '../../components/ui/patterned-green-header';

interface SummaryTeam { id: string; name: string; logo_url?: string | null; primary_color?: string | null }
interface Summary {
  teams: SummaryTeam[];
  leagues: { id: string; name: string; status: string }[];
  stats: { goals: number; assists: number; teamsCount: number; matchesPlayed: number; tournamentsCount: number };
}
interface Reservation {
  id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  status: string;
  cancel_reason?: string | null;
  terrain: { id: string; name: string; city: string; surface: string } | null;
}
interface FavoriteTerrain { id: string; name: string; city: string; surface: string }
interface PendingReview {
  id: string;
  terrain_id: string;
  terrain: { id: string; name: string; city: string };
}

function initials(name?: string | null) {
  return (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
const SURFACE_SHORT: Record<string, string> = { grass: 'Gazon', artificial: 'Synthé', futsal: 'Futsal' };
const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
const RES_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#F7921E', bg: 'rgba(247,146,30,0.15)' },
  confirmed: { label: 'Confirmé', color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' },
  cancelled: { label: 'Annulé', color: '#F87171', bg: 'rgba(248,113,113,0.15)' },
};
function hh(h: number) {
  const hour = Math.floor(h);
  const minutes = Math.round((h - hour) * 60);
  return `${String(hour).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`;
}

const LEAGUE_TABS = ['Activité', 'Équipes', 'Historique'] as const;
const RES_TABS = ['À venir', 'Passées', 'Annulées', 'Favoris'] as const;
// Réservations expirées faute de validation dans le délai du panier : ce sont
// des « non-actions », on ne les affiche ni dans Passées ni dans Annulées.
const EXPIRED_CART_REASON = 'Délai de validation du panier expiré';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { mode } = useUserModeStore();
  const isReservation = mode === 'reservation';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteTerrain[]>([]);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [leagueTab, setLeagueTab] = useState<(typeof LEAGUE_TABS)[number]>('Activité');
  const [resTab, setResTab] = useState<(typeof RES_TABS)[number]>('À venir');

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name as string | undefined)?.trim() || 'Mon profil';
  const position = (meta.position as string | undefined)?.trim();
  const city = (meta.city as string | undefined)?.trim();
  // On n'affiche que les URL publiques (http…). Les anciennes URI locales
  // (file://, ph://) enregistrées avant l'upload Storage ne s'affichent pas →
  // repli sur les initiales.
  const photoRaw = (meta.photo_url as string | undefined)?.trim();
  const photo = photoRaw?.startsWith('http') ? photoRaw : undefined;
  const subtitle = isReservation ? (city ?? '') : [city, position].filter(Boolean).join(' · ');

  const load = useCallback(async () => {
    if (isReservation) {
      const [r, fav, pending] = await Promise.all([
        getCached<Reservation[]>('/api/v1/reservations/mine', 20_000).catch(() => []),
        getCached<FavoriteTerrain[]>('/api/v1/terrains/favorites', 30_000).catch(() => []),
        getCached<PendingReview | null>('/api/v1/terrains/reviews/pending', 20_000).catch(() => null),
      ]);
      setReservations(Array.isArray(r) ? r : []);
      setFavorites(Array.isArray(fav) ? fav : []);
      setPendingReview(pending);
    } else {
      const sum = await getCached<Summary>('/api/v1/users/me/summary', 20_000).catch(() => null);
      setSummary(sum);
    }
  }, [isReservation]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openSettings() {
    router.push('/settings');
  }

  // ── Données réservation ──
  const todayYmd = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  // À venir : réservations non annulées dont la date n'est pas passée.
  const upcoming = reservations.filter((r) => r.reservation_date >= todayYmd && r.status !== 'cancelled');
  // Passées : uniquement celles VALIDÉES (confirmées) dont la date est déjà passée.
  const past = reservations.filter((r) => r.status === 'confirmed' && r.reservation_date < todayYmd);
  // Annulées : vraies annulations (clic « Annuler » / annulation partenaire), pas les expirations de panier.
  const cancelledList = reservations.filter((r) => r.status === 'cancelled' && r.cancel_reason !== EXPIRED_CART_REASON);
  async function submitReview() {
    if (!pendingReview || reviewRating === 0) {
      Alert.alert('Note requise', 'Choisis une note entre 1 et 5 étoiles.');
      return;
    }
    try {
      setSavingReview(true);
      await apiClient.post(`/api/v1/terrains/${pendingReview.terrain_id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      invalidateCached('/api/v1/terrains/reviews');
      invalidateCached('/api/v1/terrains');
      setPendingReview(null);
      setReviewRating(0);
      setReviewComment('');
    } catch {
      Alert.alert('Avis non envoyé', "Réessaie dans un instant.");
    } finally {
      setSavingReview(false);
    }
  }

  return (
    <ScreenBackground>
      {/* Header vert à motifs triangulaires */}
      <PatternedGreenHeader
        style={{ paddingTop: 52, paddingBottom: 22, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' }}
        patternOpacity={0.5}
      >
        <View className="flex-row items-center">
          <View style={{ width: 28 }} />
          <Text className="text-white font-black text-xl flex-1 text-center">Profil</Text>
          <Pressable onPress={openSettings} hitSlop={8} style={{ width: 28, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-4 mt-4">
          {photo ? (
            <RemoteImage uri={imageThumb(photo, 200)} style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' }} />
          ) : (
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <Text className="text-white font-black text-2xl">{initials(name)}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-white font-black text-2xl" numberOfLines={1}>{name}</Text>
            {subtitle ? <Text className="text-white/85 text-sm mt-0.5">📍 {subtitle}</Text> : null}
            <View
              className="self-start flex-row items-center gap-1.5 px-3 py-1.5 rounded-full mt-2"
              style={{ backgroundColor: isReservation ? '#FFFFFF' : '#F7921E' }}
            >
              <Text style={{ fontSize: 12 }}>{isReservation ? '🏟️' : '⚽'}</Text>
              <Text className="text-xs font-bold" style={{ color: isReservation ? '#1E7A3A' : '#FFFFFF' }}>
                {isReservation ? 'Mode Réservation' : 'Mode Leagues'}
              </Text>
            </View>
          </View>
        </View>
      </PatternedGreenHeader>

      {isReservation ? (
        <ReservationBody
          reservations={reservations}
          upcoming={upcoming}
          past={past}
          cancelled={cancelledList}
          favTerrains={favorites}
          tab={resTab}
          setTab={setResTab}
          onOpenTerrain={(id) => router.push(`/terrain/${id}`)}
          onOpenReservation={(id) => router.push(`/reservation/${id}`)}
        />
      ) : (
        <LeaguesBody summary={summary} tab={leagueTab} setTab={setLeagueTab} router={router} />
      )}
      <ReviewModal
        pending={pendingReview}
        rating={reviewRating}
        comment={reviewComment}
        saving={savingReview}
        onRating={setReviewRating}
        onComment={setReviewComment}
        onSubmit={submitReview}
        onDismiss={() => setPendingReview(null)}
      />
    </ScreenBackground>
  );
}

// ─────────────────────────── Mode Réservation (s31) ───────────────────────────
function ResDateBadge({ ymd, index }: { ymd: string; index: number }) {
  const [, m, d] = ymd.slice(0, 10).split('-').map(Number);
  const bg = index % 2 === 0 ? '#F7921E' : '#1E7A3A';
  return (
    <View className="w-14 h-14 rounded-xl items-center justify-center" style={{ backgroundColor: bg }}>
      <Text className="text-white font-black text-lg leading-5">{d}</Text>
      <Text className="text-white/90 text-[10px] font-bold">{MONTHS[(m ?? 1) - 1]}</Text>
    </View>
  );
}

function ReservationBody({
  reservations, upcoming, past, cancelled, favTerrains, tab, setTab, onOpenTerrain, onOpenReservation,
}: {
  reservations: Reservation[];
  upcoming: Reservation[];
  past: Reservation[];
  cancelled: Reservation[];
  favTerrains: { id: string; name: string; city: string; surface: string }[];
  tab: (typeof RES_TABS)[number];
  setTab: (t: (typeof RES_TABS)[number]) => void;
  onOpenTerrain: (id: string) => void;
  onOpenReservation: (id: string) => void;
}) {
  const list = tab === 'À venir' ? upcoming : tab === 'Passées' ? past : tab === 'Annulées' ? cancelled : [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {/* Stats */}
      <View className="flex-row gap-2.5 mb-5">
        <View className="flex-1 rounded-2xl items-center py-5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#F7921E' }}>
          <Text className="font-black text-2xl" style={{ color: '#F7921E' }}>{reservations.length}</Text>
          <Text className="text-white/55 text-xs mt-1">Réservations</Text>
        </View>
        <View className="flex-1 rounded-2xl items-center py-5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Text className="font-black text-2xl text-white">{favTerrains.length}</Text>
          <Text className="text-white/55 text-xs mt-1">Terrains favoris</Text>
        </View>
      </View>

      {/* Onglets */}
      <View className="flex-row gap-6 border-b mb-4" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }}>
        {RES_TABS.map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} className="pb-2.5" style={{ borderBottomWidth: active ? 2 : 0, borderBottomColor: '#2E9E4F' }}>
              <Text className="font-bold" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.45)' }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'Favoris' ? (
        favTerrains.length ? (
          favTerrains.map((t) => (
            <Pressable key={t.id} onPress={() => onOpenTerrain(t.id)} className="flex-row items-center gap-3 rounded-2xl p-4 mb-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: '#0F3D1E' }}><Text style={{ fontSize: 20 }}>🏟️</Text></View>
              <View className="flex-1">
                <Text className="text-white font-bold">{t.name}</Text>
                <Text className="text-white/50 text-sm mt-0.5">{t.city}{t.surface ? ` · ${SURFACE_SHORT[t.surface] ?? t.surface}` : ''}</Text>
              </View>
              <Text className="text-white/40">›</Text>
            </Pressable>
          ))
        ) : (
          <Text className="text-white/45 text-sm text-center py-8">Aucun terrain enregistré pour l&apos;instant.</Text>
        )
      ) : list.length === 0 ? (
        <View className="items-center py-10 px-8">
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📅</Text>
          <Text className="text-white/50 text-center text-sm">
            {tab === 'À venir' ? 'Aucune réservation à venir.' : tab === 'Annulées' ? 'Aucune réservation annulée.' : 'Aucune réservation passée.'}
          </Text>
        </View>
      ) : (
        list.map((r, i) => {
          const st = RES_STATUS[r.status] ?? RES_STATUS.pending;
          return (
            <Pressable key={r.id} onPress={() => onOpenReservation(r.id)} className="flex-row items-center gap-3 rounded-2xl p-3.5 mb-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <ResDateBadge ymd={r.reservation_date} index={i} />
              <View className="flex-1">
                <Text className="text-white font-bold text-base" numberOfLines={1}>{r.terrain?.name ?? 'Terrain'}</Text>
                <Text className="text-white/50 text-sm mt-0.5">
                  {hh(r.start_hour)} – {hh(r.end_hour)}{r.terrain?.surface ? ` · ${SURFACE_SHORT[r.terrain.surface] ?? r.terrain.surface}` : ''}
                </Text>
              </View>
              <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: st.bg }}>
                <Text className="text-xs font-bold" style={{ color: st.color }}>{st.label}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function ReviewModal({
  pending, rating, comment, saving, onRating, onComment, onSubmit, onDismiss,
}: {
  pending: PendingReview | null;
  rating: number;
  comment: string;
  saving: boolean;
  onRating: (value: number) => void;
  onComment: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.64)' }}>
        <View className="w-full rounded-3xl p-6" style={{ backgroundColor: '#102817', borderWidth: 1, borderColor: 'rgba(46,158,79,0.5)' }}>
          <Text className="text-white text-xl font-black text-center">Ton match est terminé ?</Text>
          <Text className="text-white/70 text-center text-sm mt-2">
            Donne ton avis sur {pending?.terrain.name ?? 'ce terrain'}.
          </Text>
          <View className="flex-row justify-center gap-2 mt-5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => onRating(star)} hitSlop={6}>
                <Text style={{ fontSize: 34, color: star <= rating ? '#FFB830' : 'rgba(255,255,255,0.22)' }}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={comment}
            onChangeText={onComment}
            placeholder="Un mot sur ton expérience ? (facultatif)"
            placeholderTextColor="rgba(255,255,255,0.38)"
            multiline
            maxLength={500}
            className="text-white text-sm rounded-2xl px-4 py-3 mt-5"
            style={{ minHeight: 76, textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
          />
          <Pressable disabled={saving} onPress={onSubmit} className="rounded-2xl py-4 mt-4 items-center active:opacity-80" style={{ backgroundColor: '#F7921E', opacity: saving ? 0.6 : 1 }}>
            <Text className="text-white font-black">{saving ? 'Envoi…' : 'Publier mon avis'}</Text>
          </Pressable>
          <Pressable disabled={saving} onPress={onDismiss} className="py-3 mt-1 items-center">
            <Text className="text-white/55 font-semibold text-sm">Plus tard</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────── Mode Leagues (s30) ───────────────────────────
function LeaguesBody({ summary, tab, setTab, router }: {
  summary: Summary | null;
  tab: (typeof LEAGUE_TABS)[number];
  setTab: (t: (typeof LEAGUE_TABS)[number]) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const s = summary?.stats;
  const goals = s?.goals ?? 0;
  const assists = s?.assists ?? 0;
  const stats = [
    { value: s?.matchesPlayed ?? 0, label: 'Matchs', active: false },
    { value: goals, label: 'Buts', active: true },
    { value: assists, label: 'Passes', active: false },
    { value: s?.tournamentsCount ?? 0, label: 'Tournois', active: false },
  ];
  const achievements = [
    { emoji: '🏆', label: 'Champion S1', unlocked: false },
    { emoji: '⚽', label: 'Meilleur buteur', unlocked: goals >= 10 },
    { emoji: '🔥', label: 'Série de 5', unlocked: goals >= 5 },
    { emoji: '🎯', label: '10 passes', unlocked: assists >= 10 },
  ];
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row gap-2.5 mb-5">
        {stats.map((st) => (
          <View key={st.label} className="flex-1 rounded-2xl items-center py-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: st.active ? '#F7921E' : 'rgba(255,255,255,0.08)' }}>
            <Text className="font-black text-2xl" style={{ color: st.active ? '#F7921E' : '#fff' }}>{st.value}</Text>
            <Text className="text-white/55 text-xs mt-1">{st.label}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={() => router.push('/team')} className="flex-row items-center gap-4 rounded-2xl p-4 mb-3" style={{ backgroundColor: 'rgba(247,146,30,0.06)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.4)' }}>
        <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}><Text style={{ fontSize: 20 }}>👥</Text></View>
        <View className="flex-1">
          <Text className="text-white font-black text-base">Mon équipe</Text>
          <Text className="text-white/50 text-sm mt-0.5">{summary?.teams?.length ? summary.teams[0].name : 'Créer ou rejoindre une équipe'}</Text>
        </View>
        <Text className="text-white/40 text-lg">›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/player-profile')} className="flex-row items-center gap-4 rounded-2xl p-4 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(247,146,30,0.15)' }}><Text style={{ fontSize: 20 }}>✏️</Text></View>
        <View className="flex-1">
          <Text className="text-white font-black text-base">Modifier ma fiche joueur</Text>
          <Text className="text-white/50 text-sm mt-0.5">Poste, pied fort, niveau, physique…</Text>
        </View>
        <Text className="text-white/40 text-lg">›</Text>
      </Pressable>

      {unlockedAchievements.length > 0 ? (
        <>
          <Text className="text-white font-black text-lg mb-3">Accomplissements</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} className="mb-6">
        {unlockedAchievements.map((a) => (
          <View key={a.label} className="items-center" style={{ width: 92 }}>
            <View className="w-20 h-20 rounded-2xl items-center justify-center" style={{ backgroundColor: 'rgba(247,146,30,0.12)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.5)' }}>
              <Text style={{ fontSize: 34 }}>{a.emoji}</Text>
            </View>
            <Text className="text-white/60 text-xs text-center mt-1.5" numberOfLines={1}>{a.label}</Text>
          </View>
        ))}
          </ScrollView>
        </>
      ) : null}

      <View className="flex-row gap-6 border-b mb-4" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }}>
        {LEAGUE_TABS.map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} className="pb-2.5" style={{ borderBottomWidth: active ? 2 : 0, borderBottomColor: '#2E9E4F' }}>
              <Text className="font-bold" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.45)' }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'Équipes' ? (
        summary?.teams?.length ? (
          summary.teams.map((t) => (
            <Pressable key={t.id} onPress={() => router.push('/team')} className="flex-row items-center gap-3 rounded-2xl p-3.5 mb-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center overflow-hidden" style={{ backgroundColor: t.primary_color?.trim() || '#1E7A3A' }}>
                {t.logo_url ? <RemoteImage uri={imageThumb(t.logo_url, 120)} style={{ width: '100%', height: '100%' }} /> : <Text className="text-white font-bold text-xs">{initials(t.name)}</Text>}
              </View>
              <Text className="text-white font-semibold flex-1">{t.name}</Text>
              <Text className="text-white/40">›</Text>
            </Pressable>
          ))
        ) : (
          <Text className="text-white/45 text-sm text-center py-8">Tu n&apos;as pas encore d&apos;équipe.</Text>
        )
      ) : tab === 'Historique' ? (
        <Text className="text-white/45 text-sm text-center py-8">
          {summary?.leagues?.length ? `${summary.leagues.length} ligue(s) rejointe(s).` : 'Ton historique apparaîtra ici après tes premiers matchs.'}
        </Text>
      ) : (
        <Text className="text-white/45 text-sm text-center py-8">Tes buts, passes et faits marquants apparaîtront ici.</Text>
      )}
    </ScrollView>
  );
}
