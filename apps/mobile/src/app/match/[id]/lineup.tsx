import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../../lib/api';
import { AppHeader } from '../../../components/ui/app-header';
import { ScreenBackground } from '../../../components/ui/screen-background';
import {
  OUTFIELD_TOTAL, SQUAD_TOTAL, POS_ORDER, POS_LABEL, type PosBucket,
  positionBucket, formationString, parseFormation,
} from '../../../lib/lineup';

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

export default function LineupPublishScreen() {
  const { id, team } = useLocalSearchParams<{ id: string; team: string }>();
  const router = useRouter();

  const [data, setData] = useState<MatchSquads | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Formation foot à 7 : gardien fixe (1) + compteurs de champ (total = 6).
  const [def, setDef] = useState(2);
  const [mid, setMid] = useState(3);
  const [att, setAtt] = useState(1);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [positions, setPositions] = useState<Record<string, PosBucket>>({});

  const load = useCallback(async () => {
    if (!id || !team) return;
    try {
      const [{ data: match }, { data: lineups }] = await Promise.all([
        apiClient.get<MatchSquads>(`/api/v1/matches/${id}`),
        apiClient.get<LineupsResponse>(`/api/v1/matches/${id}/lineups`),
      ]);
      setData(match);
      const side = lineups.home?.team.id === team ? lineups.home : lineups.away?.team.id === team ? lineups.away : null;
      if (side?.lineup) {
        if (side.lineup.formation) {
          const f = parseFormation(side.lineup.formation);
          setDef(f.def); setMid(f.mid); setAtt(f.att);
        }
        const rMap: Record<string, Role> = {};
        const pMap: Record<string, PosBucket> = {};
        for (const p of side.lineup.players) {
          if (!p.user_id) continue;
          rMap[p.user_id] = p.role;
          pMap[p.user_id] = positionBucket(p.position);
        }
        setRoles(rMap);
        setPositions(pMap);
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
  const outfield = def + mid + att;

  // Poste retenu pour un joueur (choix explicite, sinon poste de sa fiche).
  const posOf = useCallback(
    (m: SquadMember): PosBucket => positions[m.user!.id] ?? positionBucket(m.user!.position),
    [positions],
  );

  function cycle(userId: string) {
    setRoles((prev) => {
      const cur = prev[userId] ?? 'none';
      const next: Role = cur === 'none' ? 'starter' : cur === 'starter' ? 'sub' : 'none';
      return { ...prev, [userId]: next };
    });
  }

  function setPos(userId: string, bucket: PosBucket) {
    setPositions((prev) => ({ ...prev, [userId]: bucket }));
  }

  // Ajuste un compteur de champ en gardant le total ≤ 6.
  function bump(which: 'def' | 'mid' | 'att', delta: number) {
    const setter = which === 'def' ? setDef : which === 'mid' ? setMid : setAtt;
    const value = which === 'def' ? def : which === 'mid' ? mid : att;
    const next = value + delta;
    if (next < 0) return;
    if (delta > 0 && outfield >= OUTFIELD_TOTAL) return; // total déjà à 6
    setter(next);
  }

  async function submit(publish: boolean) {
    if (saving) return;
    if (outfield !== OUTFIELD_TOTAL) {
      Alert.alert('Formation incomplète', `La formation doit compter ${OUTFIELD_TOTAL} joueurs de champ (plus le gardien). Actuellement : ${outfield}.`);
      return;
    }
    const players: LineupPlayer[] = members
      .filter((m) => m.user && (roles[m.user.id] ?? 'none') !== 'none')
      .map((m) => ({
        name: m.user!.full_name ?? 'Joueur',
        role: (roles[m.user!.id] as 'starter' | 'sub'),
        number: m.jersey_num,
        position: POS_LABEL[posOf(m)],
        user_id: m.user!.id,
      }));
    if (publish && players.filter((p) => p.role === 'starter').length === 0) {
      Alert.alert('Composition incomplète', 'Sélectionne au moins les titulaires avant de publier.');
      return;
    }
    const starterCount = players.filter((p) => p.role === 'starter').length;
    if (publish && starterCount !== SQUAD_TOTAL) {
      const go = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Titulaires',
          `Le football à 7 se joue à ${SQUAD_TOTAL} titulaires (1 gardien + ${OUTFIELD_TOTAL}). Tu en as ${starterCount}. Publier quand même ?`,
          [
            { text: 'Corriger', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Publier', onPress: () => resolve(true) },
          ],
        );
      });
      if (!go) return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/api/v1/matches/${id}/lineup`, { team_id: team, formation: formationString(def, mid, att), players, publish });
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
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Text className="text-white font-black text-lg">{teamName}</Text>
        <Text className="text-white/55 text-sm mt-1 mb-4">Football à 7 : 1 gardien + {OUTFIELD_TOTAL} joueurs de champ. Touche un joueur pour l’ajouter (Titulaire → Remplaçant → retiré) et choisis son poste.</Text>

        {/* Formation foot à 7 */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white font-bold text-sm">Formation</Text>
          <Text className="text-xs font-bold" style={{ color: outfield === OUTFIELD_TOTAL ? '#4ADE80' : '#F87171' }}>
            {outfield}/{OUTFIELD_TOTAL} joueurs de champ
          </Text>
        </View>

        {/* Gardien verrouillé */}
        <View className="flex-row items-center justify-between rounded-xl p-3 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Text className="text-white font-semibold text-sm">🧤 Gardien</Text>
          <Text className="text-white/60 text-sm font-bold">1 (obligatoire)</Text>
        </View>

        {([['def', 'Défenseurs', def], ['mid', 'Milieux', mid], ['att', 'Attaquants', att]] as const).map(([key, label, value]) => (
          <View key={key} className="flex-row items-center justify-between rounded-xl p-3 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Text className="text-white font-semibold text-sm">{label}</Text>
            <View className="flex-row items-center gap-4">
              <Stepper onPress={() => bump(key, -1)} disabled={value <= 0} label="−" />
              <Text className="text-white font-black text-base" style={{ width: 20, textAlign: 'center' }}>{value}</Text>
              <Stepper onPress={() => bump(key, +1)} disabled={outfield >= OUTFIELD_TOTAL} label="+" />
            </View>
          </View>
        ))}
        <Text className="text-white/40 text-xs mt-1 mb-5">Schéma : {formationString(def, mid, att)} (gardien inclus).</Text>

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
          const badge = role === 'starter' ? { t: 'Titulaire', c: '#4ADE80' } : role === 'sub' ? { t: 'Remplaçant', c: '#FFB830' } : { t: 'Ajouter', c: 'rgba(255,255,255,0.5)' };
          const bucket = posOf(m);
          return (
            <View key={m.user.id} className="rounded-xl p-3 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: role === 'none' ? 'rgba(255,255,255,0.08)' : badge.c }}>
              <Pressable onPress={() => cycle(m.user!.id)} className="flex-row items-center gap-3">
                <Text className="text-white/40 text-xs" style={{ width: 24 }}>{m.jersey_num ?? '—'}</Text>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-sm">{m.user.full_name ?? 'Joueur'}</Text>
                  {m.user.position ? <Text className="text-white/40 text-xs">Fiche : {m.user.position}</Text> : null}
                </View>
                <Text className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: badge.c, backgroundColor: `${badge.c}22` }}>{badge.t}</Text>
              </Pressable>

              {/* Choix du poste (indépendant de la fiche) — visible dès que le joueur est retenu */}
              {role !== 'none' ? (
                <View className="flex-row gap-2 mt-3">
                  {POS_ORDER.map((b) => {
                    const active = bucket === b;
                    return (
                      <Pressable key={b} onPress={() => setPos(m.user!.id, b)} className="flex-1 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: active ? 'rgba(247,146,30,0.16)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.12)' }}>
                        <Text className="text-xs font-bold" style={{ color: active ? '#F7921E' : 'rgba(255,255,255,0.6)' }}>{POS_LABEL[b]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
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

function Stepper({ onPress, disabled, label }: { onPress: () => void; disabled: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(247,146,30,0.16)', borderWidth: 1, borderColor: disabled ? 'rgba(255,255,255,0.1)' : '#F7921E', opacity: disabled ? 0.5 : 1 }}>
      <Text className="text-lg font-black" style={{ color: disabled ? 'rgba(255,255,255,0.3)' : '#F7921E' }}>{label}</Text>
    </Pressable>
  );
}
