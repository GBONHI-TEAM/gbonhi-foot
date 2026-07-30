import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { apiClient } from '../../../lib/api';

interface League {
  id: string;
  name: string;
  status: string;
  level?: string | null;
  registration_fee?: number | null;
  prize_info?: string | null;
}
interface MyTeam { id: string; name: string; primary_color?: string | null }

function fcfa(n?: number | null) {
  return `${(n ?? 0).toLocaleString('fr-FR')} FCFA`;
}
function initials(name?: string | null) {
  return (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function InscriptionLeaguePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [league, setLeague] = useState<League | null>(null);
  const [team, setTeam] = useState<MyTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const [l, s] = await Promise.all([
        apiClient.get<League>(`/api/v1/leagues/${id}`).then((r) => r.data).catch(() => null),
        apiClient.get<{ teams: MyTeam[] }>('/api/v1/users/me/summary').then((r) => r.data).catch(() => null),
      ]);
      setLeague(l);
      setTeam(s?.teams?.[0] ?? null);
      setLoading(false);
    })();
  }, [id]);

  async function handleRegister() {
    if (!team || !league) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/api/v1/leagues/${id}/teams`, { team_id: team.id });
      setDone(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('Inscription impossible', Array.isArray(msg) ? msg.join('\n') : msg ?? "Réessaie plus tard.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      </ScreenBackground>
    );
  }

  /* Confirmation */
  if (done) {
    return (
      <ScreenBackground style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: '#1E7A3A' }}>
          <Text className="text-white text-4xl">✓</Text>
        </View>
        <Text className="text-white font-black text-2xl text-center mb-3">Inscription confirmée !</Text>
        <Text className="text-center text-sm mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <Text className="text-white font-semibold">{team?.name}</Text> est inscrite à{' '}
          <Text className="text-white font-semibold">{league?.name}</Text>.
        </Text>
        <Pressable onPress={() => router.replace(`/league/${id}`)} className="w-full h-14 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: '#F7921E' }}>
          <Text className="text-white font-bold text-base">Voir la ligue</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} className="w-full h-12 rounded-2xl items-center justify-center border" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          <Text className="text-white font-semibold text-sm">Retour à l&apos;accueil</Text>
        </Pressable>
      </ScreenBackground>
    );
  }

  const fee = league?.registration_fee ?? 0;

  return (
    <ScreenBackground>
      <View className="flex-row items-center px-5 pt-14 pb-4 gap-3" style={{ backgroundColor: '#1E7A3A' }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text className="text-white text-2xl">‹</Text></Pressable>
        <Text className="text-white font-black text-xl flex-1 text-center mr-7">Inscription en league</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Carte ligue + équipe */}
        <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Text className="text-white font-black text-lg mb-2">{league?.name}</Text>
          {league?.level?.trim() ? (
            <View className="self-start px-2.5 py-0.5 rounded-full mb-3" style={{ backgroundColor: 'rgba(247,146,30,0.15)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.4)' }}>
              <Text className="text-xs font-semibold" style={{ color: '#F7921E' }}>Niveau : {league.level}</Text>
            </View>
          ) : null}
          <View className="h-px my-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
          {team ? (
            <View className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: team.primary_color?.trim() || '#1E7A3A' }}>
                <Text className="text-white font-black text-sm">{initials(team.name)}</Text>
              </View>
              <View>
                <Text className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Équipe inscrite</Text>
                <Text className="text-white font-bold">{team.name}</Text>
              </View>
            </View>
          ) : (
            <Text className="text-sm" style={{ color: '#F7921E' }}>Tu n&apos;as pas d&apos;équipe. Crée ou rejoins-en une d&apos;abord.</Text>
          )}
        </View>

        {/* Coûts */}
        <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <View className="flex-row justify-between py-2.5 border-b" style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}>
            <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Coût d&apos;inscription</Text>
            <Text className="text-sm font-semibold text-white">{fcfa(fee)}</Text>
          </View>
          {league?.prize_info?.trim() ? (
            <View className="flex-row justify-between py-2.5 border-b" style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}>
              <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Récompenses de la ligue</Text>
              <Text className="text-sm font-semibold" style={{ color: '#4ADE80' }}>{league.prize_info}</Text>
            </View>
          ) : null}
          <View className="flex-row justify-between pt-3">
            <Text className="font-bold text-white">Total à payer</Text>
            <Text className="font-black text-lg" style={{ color: '#F7921E' }}>{fcfa(fee)}</Text>
          </View>
        </View>

        {/* Accept règlement */}
        <Pressable onPress={() => setAccepted(!accepted)} className="flex-row items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: accepted ? '#1E7A3A' : 'rgba(255,255,255,0.1)' }}>
          <View className="w-5 h-5 rounded border-2 items-center justify-center flex-shrink-0" style={{ borderColor: accepted ? '#1E7A3A' : 'rgba(255,255,255,0.3)', backgroundColor: accepted ? '#1E7A3A' : 'transparent' }}>
            {accepted && <Text className="text-white text-xs font-bold">✓</Text>}
          </View>
          <Text className="text-sm flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
            J&apos;ai lu et j&apos;accepte le{' '}
            <Text onPress={() => router.push(`/league/${id}`)} style={{ color: '#F7921E', textDecorationLine: 'underline' }}>règlement intérieur</Text>{' '}de la league
          </Text>
        </Pressable>

        {fee > 0 ? (
          <Text className="text-xs mt-3 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Le paiement en ligne (Wave · MTN · Orange) sera activé prochainement. L&apos;inscription est enregistrée dès maintenant.
          </Text>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-8">
        <Pressable
          onPress={team ? handleRegister : () => router.push('/team')}
          disabled={submitting || (!!team && !accepted)}
          className="h-14 rounded-2xl items-center justify-center"
          style={{ backgroundColor: team ? '#1E7A3A' : '#F7921E', opacity: !!team && !accepted ? 0.4 : 1 }}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">{team ? 'Confirmer l\'inscription' : 'Créer / rejoindre une équipe'}</Text>}
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
