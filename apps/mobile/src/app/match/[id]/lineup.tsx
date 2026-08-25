import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../../lib/api';
import { AppHeader } from '../../../components/ui/app-header';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { KB_DONE_ID } from '../../../components/ui/keyboard-done-bar';

interface SquadMember {
  team_id: string;
  jersey_num: number | null;
  user: { id: string; full_name: string | null; position: string | null } | null;
}
interface MatchSquads {
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
  squads: { home: SquadMember[]; away: SquadMember[] };
}
interface LineupPlayer { name: string; role: 'starter' | 'sub'; number: number | null; position: string | null; user_id: string | null }
interface LineupsResponse {
  home: { team: { id: string; name: string }; lineup: { formation: string | null; players: LineupPlayer[] } | null } | null;
  away: { team: { id: string; name: string }; lineup: { formation: string | null; players: LineupPlayer[] } | null } | null;
}

type Role = 'none' | 'starter' | 'sub';
const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-1-2-1-2'];

export default function LineupPublishScreen() {
  const { id, team } = useLocalSearchParams<{ id: string; team: string }>();
  const router = useRouter();

  const [data, setData] = useState<MatchSquads | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formation, setFormation] = useState('4-3-3');
  const [roles, setRoles] = useState<Record<string, Role>>({});

  const load = useCallback(async () => {
    if (!id || !team) return;
    try {
      const [{ data: match }, { data: lineups }] = await Promise.all([
        apiClient.get<MatchSquads>(`/api/v1/matches/${id}`),
        apiClient.get<LineupsResponse>(`/api/v1/matches/${id}/lineups`),
      ]);
      setData(match);
      // Préremplissage depuis la composition existante.
      const side = lineups.home?.team.id === team ? lineups.home : lineups.away?.team.id === team ? lineups.away : null;
      if (side?.lineup) {
        if (side.lineup.formation) setFormation(side.lineup.formation);
        const map: Record<string, Role> = {};
        for (const p of side.lineup.players) if (p.user_id) map[p.user_id] = p.role;
        setRoles(map);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger l’effectif.');
    } finally {
      setLoading(false);
    }
  }, [id, team]);

  useEffect(() => { load(); }, [load]);

  const members = useMemo(() => {
    if (!data) return [];
    return team === data.home_team.id ? data.squads.home : data.squads.away;
  }, [data, team]);

  const teamName = data ? (team === data.home_team.id ? data.home_team.name : data.away_team.name) : '';
  const starters = members.filter((m) => m.user && roles[m.user.id] === 'starter').length;
  const subs = members.filter((m) => m.user && roles[m.user.id] === 'sub').length;

  function cycle(userId: string) {
    setRoles((prev) => {
      const cur = prev[userId] ?? 'none';
      const next: Role = cur === 'none' ? 'starter' : cur === 'starter' ? 'sub' : 'none';
      return { ...prev, [userId]: next };
    });
  }

  async function submit(publish: boolean) {
    if (saving) return;
    const players: LineupPlayer[] = members
      .filter((m) => m.user && (roles[m.user.id] ?? 'none') !== 'none')
      .map((m) => ({
        name: m.user!.full_name ?? 'Joueur',
        role: (roles[m.user!.id] as 'starter' | 'sub'),
        number: m.jersey_num,
        position: m.user!.position,
        user_id: m.user!.id,
      }));
    if (publish && players.filter((p) => p.role === 'starter').length === 0) {
      Alert.alert('Composition incomplète', 'Sélectionne au moins les titulaires avant de publier.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/api/v1/matches/${id}/lineup`, { team_id: team, formation, players, publish });
      Alert.alert(publish ? 'Composition publiée' : 'Brouillon enregistré', publish ? 'Ta composition est visible par tous.' : 'Tu pourras la publier plus tard.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Réessaie dans quelques instants.';
      Alert.alert('Publication impossible', msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenBackground>
        <AppHeader title="Composition" centered showLogo={false} onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <AppHeader title="Ma composition" centered showLogo={false} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text className="text-white font-black text-lg">{teamName}</Text>
        <Text className="text-white/55 text-sm mt-1 mb-4">Touche un joueur pour l’ajouter : Titulaire → Remplaçant → retiré.</Text>

        {/* Formation */}
        <Text className="text-white font-bold text-sm mb-2">Formation</Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {FORMATIONS.map((f) => {
            const active = formation === f;
            return (
              <Pressable key={f} onPress={() => setFormation(f)} className="px-3.5 py-2 rounded-full" style={{ backgroundColor: active ? 'rgba(247,146,30,0.15)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.15)' }}>
                <Text className="text-sm font-semibold" style={{ color: active ? '#F7921E' : 'rgba(255,255,255,0.7)' }}>{f}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={formation}
          onChangeText={setFormation}
          placeholder="Autre (ex. 4-3-3)"
          placeholderTextColor="rgba(255,255,255,0.4)"
          inputAccessoryViewID={KB_DONE_ID}
          className="h-12 rounded-input px-4 text-white text-base mb-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
        />

        {/* Effectif */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white font-bold text-sm">Effectif</Text>
          <Text className="text-white/50 text-xs">{starters} titulaires · {subs} remplaçants</Text>
        </View>
        {members.length === 0 ? (
          <Text className="text-white/50 text-sm py-6 text-center">Aucun membre actif dans cette équipe.</Text>
        ) : members.map((m) => {
          if (!m.user) return null;
          const role = roles[m.user.id] ?? 'none';
          const badge = role === 'starter' ? { t: 'Titulaire', c: '#4ADE80', bg: 'rgba(46,158,79,0.15)' } : role === 'sub' ? { t: 'Remplaçant', c: '#FFB830', bg: 'rgba(255,184,48,0.12)' } : { t: 'Ajouter', c: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)' };
          return (
            <Pressable key={m.user.id} onPress={() => cycle(m.user!.id)} className="flex-row items-center gap-3 rounded-xl p-3 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: role === 'none' ? 'rgba(255,255,255,0.08)' : badge.c }}>
              <Text className="text-white/40 text-xs" style={{ width: 24 }}>{m.jersey_num ?? '—'}</Text>
              <View className="flex-1">
                <Text className="text-white font-semibold text-sm">{m.user.full_name ?? 'Joueur'}</Text>
                {m.user.position ? <Text className="text-white/40 text-xs">{m.user.position}</Text> : null}
              </View>
              <Text className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: badge.c, backgroundColor: badge.bg }}>{badge.t}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Actions */}
      <View className="px-5 pt-2 pb-8 gap-2.5" style={{ backgroundColor: '#0D1F0D' }}>
        <Pressable onPress={() => submit(true)} disabled={saving} className="h-14 rounded-btn items-center justify-center" style={{ backgroundColor: '#F7921E', opacity: saving ? 0.6 : 1 }}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold text-base">Publier la composition</Text>}
        </Pressable>
        <Pressable onPress={() => submit(false)} disabled={saving} className="h-12 rounded-btn items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
          <Text className="text-white/85 font-semibold">Enregistrer le brouillon</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
