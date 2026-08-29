import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, Share, Alert } from 'react-native';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AppHeader } from '../../components/ui/app-header';
import { copyToClipboard } from '../../lib/clipboard';
import { apiClient, teamInviteLink } from '../../lib/api';
import { buildTeamInviteMessage } from '../../lib/team-invite';
import { imageThumb } from '../../lib/image';
import { RemoteImage } from '../../components/ui/remote-image';
import { useAuthStore } from '../../store/auth.store';

interface Member {
  id: string;
  role: string;
  status: string;
  user?: { id: string; full_name?: string | null; avatar_url?: string | null; position?: string | null } | null;
}
interface TeamDetail {
  id: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  invitation_code?: string | null;
  coach_id?: string | null;
  home_terrain?: { name?: string | null; city?: string | null } | null;
  members?: Member[];
}

function initials(name?: string | null) {
  return (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
function roleLabel(role: string) {
  if (role === 'captain') return 'Capitaine';
  if (role === 'coach') return 'Coach';
  return 'Joueur';
}

export default function MonEquipePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const summary = await apiClient.get<{ teams: { id: string }[] }>('/api/v1/users/me/summary').then((r) => r.data).catch(() => null);
      const teamId = summary?.teams?.[0]?.id;
      if (!teamId) { setTeam(null); return; }
      const detail = await apiClient.get<TeamDetail>(`/api/v1/teams/${teamId}`).then((r) => r.data).catch(() => null);
      setTeam(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const isCaptain = !!team && !!user?.id && team.coach_id === user.id;
  const members = (team?.members ?? []).filter((m) => m.status === 'active');
  const pending = (team?.members ?? []).filter((m) => m.status === 'pending');
  const myMembership = (team?.members ?? []).find((m) => m.user?.id === user?.id);
  const myRequestPending = !isCaptain && myMembership?.status === 'pending';
  const joinLink = team?.invitation_code ? teamInviteLink(team.invitation_code) : '';
  const [copiedCode, setCopiedCode] = useState(false);

  async function copyCode() {
    if (!team?.invitation_code) return;
    const ok = await copyToClipboard(team.invitation_code);
    if (!ok) return;
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  }

  async function shareInvite(_kind: 'code' | 'link') {
    if (!team?.invitation_code) return;
    await Share.share({ message: buildTeamInviteMessage(team.name, team.invitation_code, joinLink) });
  }

  function promoteCaptain(m: Member) {
    if (!team || !m.user?.id) return;
    Alert.alert(
      'Nommer capitaine',
      `Transférer le capitanat à ${m.user?.full_name ?? 'ce joueur'} ? Tu redeviendras un membre normal de l'équipe.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Nommer capitaine',
          onPress: async () => {
            setBusyId(m.id);
            try {
              await apiClient.patch(`/api/v1/teams/${team.id}/captain`, { user_id: m.user!.id });
              await load();
            } catch (e: unknown) {
              const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
                ?? 'Impossible de transférer le capitanat.';
              Alert.alert('Erreur', msg);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  async function approve(m: Member) {
    if (!team) return;
    setBusyId(m.id);
    try {
      await apiClient.post(`/api/v1/teams/${team.id}/members/${m.id}/approve`);
      await load();
    } catch {
      Alert.alert('Erreur', "Impossible d'accepter cette demande.");
    } finally {
      setBusyId(null);
    }
  }

  function reject(m: Member) {
    if (!team) return;
    Alert.alert('Refuser la demande', `Refuser ${m.user?.full_name ?? 'ce joueur'} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser', style: 'destructive', onPress: async () => {
          setBusyId(m.id);
          try {
            await apiClient.delete(`/api/v1/teams/${team.id}/members/${m.id}/reject`);
            await load();
          } catch {
            Alert.alert('Erreur', 'Impossible de refuser cette demande.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <ScreenBackground>
        <AppHeader title="Mon équipe" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} showLogo={false} centered />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      </ScreenBackground>
    );
  }

  /* ── Aucun club : état vide (créer / rejoindre) ── */
  if (!team) {
    return (
      <ScreenBackground>
        <AppHeader title="Mon équipe" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} showLogo={false} centered />
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
          <View className="w-24 h-24 rounded-2xl items-center justify-center mt-8 mb-6" style={{ backgroundColor: 'rgba(30,122,58,0.25)' }}>
            <Text style={{ fontSize: 40 }}>👥</Text>
          </View>
          <Text className="text-white font-black text-2xl text-center mb-3">Tu n&apos;as pas encore d&apos;équipe</Text>
          <Text className="text-center text-sm mb-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Crée ta propre équipe et invite tes coéquipiers, ou rejoins une équipe existante avec un code d&apos;invitation.
          </Text>
          <Pressable onPress={() => router.push('/team/create')} className="w-full rounded-2xl mb-3 flex-row items-center px-5 py-4 active:opacity-80" style={{ backgroundColor: 'rgba(247,146,30,0.12)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.25)' }}>
            <View className="w-11 h-11 rounded-xl items-center justify-center mr-4 flex-shrink-0" style={{ backgroundColor: '#F7921E' }}><Text className="text-white font-black text-xl">+</Text></View>
            <View className="flex-1"><Text className="text-white font-bold text-base">Créer une équipe</Text><Text className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Deviens capitaine et gère ton effectif</Text></View>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/team/join')} className="w-full rounded-2xl flex-row items-center px-5 py-4 active:opacity-80" style={{ backgroundColor: 'rgba(30,122,58,0.15)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.3)' }}>
            <View className="w-11 h-11 rounded-xl items-center justify-center mr-4 flex-shrink-0" style={{ backgroundColor: '#1E7A3A' }}><Text className="text-white text-xl">👤</Text></View>
            <View className="flex-1"><Text className="text-white font-bold text-base">Rejoindre une équipe</Text><Text className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Avec un code d&apos;invitation reçu</Text></View>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>›</Text>
          </Pressable>
        </ScrollView>
      </ScreenBackground>
    );
  }

  /* ── Équipe existante ── */
  return (
    <ScreenBackground>
      <AppHeader title="Mon équipe" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} showLogo={false} centered />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* En-tête équipe */}
        <View className="items-center mb-5">
          <View className="w-24 h-24 rounded-2xl items-center justify-center overflow-hidden mb-3" style={{ backgroundColor: team.primary_color?.trim() || '#1E7A3A', borderWidth: 2, borderColor: team.secondary_color?.trim() || 'rgba(255,255,255,0.15)' }}>
            {team.logo_url ? (
              <RemoteImage uri={imageThumb(team.logo_url, 240)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text className="text-white font-black text-3xl">{initials(team.name)}</Text>
            )}
          </View>
          <Text className="text-white font-black text-2xl text-center">{team.name}</Text>
          {team.home_terrain?.name ? (
            <Text className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              🏟️ {team.home_terrain.name}{team.home_terrain.city ? ` · ${team.home_terrain.city}` : ''}
            </Text>
          ) : null}
          <View className="flex-row items-center gap-2 mt-2">
            <Text className="text-xs px-2.5 py-0.5 rounded-full" style={{ color: '#F7921E', backgroundColor: 'rgba(247,146,30,0.12)' }}>
              {members.length} membre{members.length > 1 ? 's' : ''}
            </Text>
            {isCaptain ? (
              <Text className="text-xs px-2.5 py-0.5 rounded-full" style={{ color: '#FFB830', backgroundColor: 'rgba(255,184,48,0.12)' }}>👑 Tu es capitaine</Text>
            ) : null}
          </View>
        </View>

        {/* Bandeau : ma demande est en attente */}
        {myRequestPending ? (
          <View className="rounded-2xl p-4 mb-5 flex-row items-center gap-3" style={{ backgroundColor: 'rgba(247,146,30,0.1)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.3)' }}>
            <Text style={{ fontSize: 20 }}>⏳</Text>
            <Text className="flex-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Ta demande est en attente de validation par le capitaine.
            </Text>
          </View>
        ) : null}

        {/* Invitation (capitaine) */}
        {isCaptain && team.invitation_code ? (
          <View className="rounded-2xl p-4 mb-5 items-center" style={{ backgroundColor: 'rgba(30,122,58,0.12)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.3)' }}>
            <Text className="text-base font-bold mb-2 text-center" style={{ color: '#FFFFFF' }}>Inviter des joueurs</Text>
            <Pressable onPress={copyCode} onLongPress={copyCode} className="items-center mb-3">
              <Text className="font-black text-2xl tracking-[0.15em]" style={{ color: '#F7921E' }}>{team.invitation_code}</Text>
              <Text className="text-xs mt-1.5" style={{ color: copiedCode ? '#4ADE80' : 'rgba(255,255,255,0.5)' }}>
                {copiedCode ? '✓ Code copié !' : 'Maintiens le code pour le copier'}
              </Text>
            </Pressable>
            <Pressable onPress={() => shareInvite('link')} className="w-full h-11 rounded-xl items-center justify-center flex-row gap-1.5" style={{ backgroundColor: 'rgba(30,122,58,0.3)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.55)' }}>
              <Text style={{ color: '#4ADE80' }}>🔗</Text><Text className="text-sm font-bold" style={{ color: '#4ADE80' }}>Partager le lien</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Demandes en attente (capitaine) */}
        {isCaptain && pending.length > 0 ? (
          <View className="mb-5">
            <Text className="text-white font-bold text-sm mb-3">
              Demandes en attente <Text style={{ color: '#F7921E' }}>({pending.length})</Text>
            </Text>
            {pending.map((m) => (
              <View key={m.id} className="flex-row items-center gap-3 rounded-xl p-3 mb-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.25)' }}>
                <View className="w-10 h-10 rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: '#1E7A3A' }}>
                  {m.user?.avatar_url ? (
                    <RemoteImage uri={imageThumb(m.user.avatar_url, 120)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text className="text-white font-bold text-xs">{initials(m.user?.full_name)}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-sm">{m.user?.full_name ?? 'Joueur'}</Text>
                  {m.user?.position ? <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{m.user.position}</Text> : null}
                </View>
                {busyId === m.id ? (
                  <ActivityIndicator color="#F7921E" />
                ) : (
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => reject(m)} className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(220,38,38,0.15)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.4)' }}>
                      <Text style={{ color: '#F87171', fontWeight: '900' }}>✕</Text>
                    </Pressable>
                    <Pressable onPress={() => approve(m)} className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: '#1E7A3A' }}>
                      <Text style={{ color: 'white', fontWeight: '900' }}>✓</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* Effectif */}
        <Text className="text-white font-bold text-sm mb-3">Effectif</Text>
        {members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => m.user?.id && router.push(`/player/${m.user.id}` as Href)}
            className="flex-row items-center gap-3 rounded-xl p-3 mb-2 active:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <View className="w-10 h-10 rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: team.primary_color?.trim() || '#1E7A3A' }}>
              {m.user?.avatar_url ? (
                <RemoteImage uri={imageThumb(m.user.avatar_url, 120)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text className="text-white font-bold text-xs">{initials(m.user?.full_name)}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-sm">{m.user?.full_name ?? 'Joueur'}</Text>
              {m.user?.position ? <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{m.user.position}</Text> : null}
            </View>
            {/* Capitaine : peut nommer un autre membre capitaine */}
            {isCaptain && m.role !== 'captain' && m.user?.id !== user?.id ? (
              <Pressable
                onPress={() => promoteCaptain(m)}
                disabled={busyId === m.id}
                className="px-3 py-1.5 rounded-full mr-1"
                style={{ borderWidth: 1, borderColor: 'rgba(255,184,48,0.55)', opacity: busyId === m.id ? 0.5 : 1 }}
              >
                <Text className="text-xs font-bold" style={{ color: '#FFB830' }}>👑 Nommer</Text>
              </Pressable>
            ) : null}
            <Text className="text-xs px-2.5 py-1 rounded-full" style={{ color: m.role === 'captain' ? '#FFB830' : 'rgba(255,255,255,0.6)', backgroundColor: m.role === 'captain' ? 'rgba(255,184,48,0.12)' : 'rgba(255,255,255,0.06)' }}>
              {roleLabel(m.role)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenBackground>
  );
}
