import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Keyboard, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenBackground } from '../../components/ui/screen-background';
import { AppHeader } from '../../components/ui/app-header';
import { apiClient } from '../../lib/api';

interface TeamPreview {
  id: string;
  name: string;
  players: number;
  city: string;
  abbr: string;
}
interface ApiTeamLookup {
  id: string;
  name: string;
  city?: string | null;
  _count?: { members: number };
  my_membership?: { id: string; status: string } | null;
}
function abbrOf(name?: string | null) {
  return (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function JoinTeamPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [resending, setResending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [team, setTeam] = useState<TeamPreview | null>(null);
  // Demande déjà envoyée et en attente d'acceptation par le capitaine.
  const [pendingRequest, setPendingRequest] = useState(false);
  const [error, setError] = useState('');

  const searchCode = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setError('');
    setTeam(null);
    setPendingRequest(false);
    setSearching(true);
    try {
      const { data } = await apiClient.get<ApiTeamLookup>(`/api/v1/teams/lookup/code/${encodeURIComponent(value)}`);
      setTeam({ id: data.id, name: data.name, players: data._count?.members ?? 0, city: data.city ?? '', abbr: abbrOf(data.name) });
      // Une demande en attente n'est pas une adhésion : on l'affiche comme telle.
      if (data.my_membership?.status === 'pending') setPendingRequest(true);
      else if (data.my_membership?.status === 'active') setError('Tu es déjà membre de cette équipe.');
    } catch {
      setError("Code d'invitation invalide ou équipe introuvable.");
    } finally {
      setSearching(false);
    }
  }, []);

  // Ouverture via lien d'invitation (gbonhi://join?code=XXXX) : pré-remplir + rechercher.
  const autoDone = useRef(false);
  useEffect(() => {
    const linkCode = params.code?.toString().trim();
    if (linkCode && !autoDone.current) {
      autoDone.current = true;
      const clean = linkCode.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      setCode(clean);
      searchCode(clean);
    }
  }, [params.code, searchCode]);

  function handleSearch() {
    return searchCode(code);
  }

  async function handleJoin() {
    if (!team) return;
    setJoining(true);
    try {
      const { data } = await apiClient.post<{ alreadyPending?: boolean }>('/api/v1/teams/join-by-code', { invitation_code: code.trim() });
      if (data?.alreadyPending) {
        setPendingRequest(true);
        return;
      }
      Alert.alert('Demande envoyée', `Ta demande pour rejoindre « ${team.name} » a été envoyée au capitaine.`, [
        { text: 'OK', onPress: () => router.replace('/team') },
      ]);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join('\n') : msg ?? "Impossible de rejoindre l'équipe.");
    } finally {
      setJoining(false);
    }
  }

  /** Relancer ma demande en attente : renotifie le capitaine. */
  async function handleResend() {
    if (!team) return;
    setResending(true);
    try {
      await apiClient.post(`/api/v1/teams/${team.id}/requests/resend`);
      Alert.alert('Demande relancée', `Le capitaine de « ${team.name} » a été relancé.`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join('\n') : msg ?? 'Impossible de relancer la demande.');
    } finally {
      setResending(false);
    }
  }

  /** Annuler ma demande en attente (ne quitte pas une équipe dont on est membre). */
  function handleCancelRequest() {
    if (!team) return;
    Alert.alert(
      'Annuler la demande ?',
      `Ta demande pour rejoindre « ${team.name} » sera annulée. Tu pourras en envoyer une nouvelle plus tard.`,
      [
        { text: 'Garder ma demande', style: 'cancel' },
        {
          text: 'Annuler la demande',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await apiClient.delete(`/api/v1/teams/${team.id}/requests/me`);
              setPendingRequest(false);
              setTeam(null);
              setCode('');
              Alert.alert('Demande annulée', 'Ta demande a été annulée.');
            } catch (e: unknown) {
              const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
              setError(Array.isArray(msg) ? msg.join('\n') : msg ?? 'Impossible d’annuler la demande.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  function formatCode(text: string) {
    const clean = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setCode(clean);
  }

  return (
    <ScreenBackground>
      <AppHeader title="Rejoindre une équipe" onBack={() => router.back()} showLogo={false} centered />

      {/* ScrollView : le clavier se ferme au scroll (on-drag) et quand on touche
          une autre partie de l'écran (taps non gérés) — plus besoin de la touche
          Entrée pour le faire disparaître. (A2) */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View className="items-center mb-6">
          <View
            className="w-20 h-20 rounded-2xl items-center justify-center mb-5"
            style={{ backgroundColor: 'rgba(30,122,58,0.25)' }}
          >
            <Text style={{ fontSize: 36 }}>👤</Text>
          </View>
          <Text className="text-white font-black text-2xl text-center mb-2">
            Saisis ton code d&apos;invitation
          </Text>
          <Text className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Le code t&apos;est communiqué par le capitaine{'\n'}de l&apos;équipe.
          </Text>
        </View>

        {/* Code input */}
        <View className="mb-4">
          <Text className="text-white font-semibold text-sm mb-2">Code d&apos;invitation</Text>
          <TextInput
            value={code}
            onChangeText={formatCode}
            placeholder="GBF-4X7K"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="characters"
            maxLength={8}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            className="h-14 px-4 rounded-xl text-white text-center text-xl font-black tracking-widest"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
          />
        </View>

        <Pressable
          onPress={handleSearch}
          disabled={searching || !code.trim()}
          className="h-13 rounded-2xl items-center justify-center mb-6"
          style={{
            height: 52,
            backgroundColor: '#F7921E',
            opacity: !code.trim() ? 0.5 : 1,
          }}
        >
          {searching ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Rechercher</Text>
          )}
        </Pressable>

        {/* Error */}
        {error ? (
          <View
            className="rounded-xl px-4 py-3 mb-4"
            style={{ backgroundColor: 'rgba(220,38,38,0.12)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)' }}
          >
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {/* Team preview */}
        {team && (
          <View
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'rgba(30,122,58,0.15)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.35)' }}
          >
            <View className="px-4 py-2 border-b" style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}>
              <Text className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>— Confirmation —</Text>
            </View>

            <View className="p-4">
              <View className="flex-row items-center gap-3 mb-3">
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center"
                  style={{ backgroundColor: '#F7921E' }}
                >
                  <Text className="text-white font-black">{team.abbr}</Text>
                </View>
                <View>
                  <Text className="text-white font-black text-base">{team.name}</Text>
                  <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {team.players} joueurs · {team.city}
                  </Text>
                </View>
              </View>

              {pendingRequest ? (
                <Text className="text-sm mb-4" style={{ color: '#F7921E' }}>
                  Demande déjà envoyée — en attente d&apos;acceptation par le capitaine.
                </Text>
              ) : (
                <Text className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Souhaites-tu rejoindre l&apos;équipe « {team.name} » ?
                </Text>
              )}

              {pendingRequest ? (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={handleCancelRequest}
                    disabled={cancelling}
                    className="flex-1 h-11 rounded-xl items-center justify-center border"
                    style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    {cancelling ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text className="text-white font-semibold text-sm">Annuler</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={handleResend}
                    disabled={resending}
                    className="flex-1 h-11 rounded-xl items-center justify-center"
                    style={{ backgroundColor: '#F7921E' }}
                  >
                    {resending ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text className="text-white font-bold text-sm">Relancer la demande</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setTeam(null)}
                    className="flex-1 h-11 rounded-xl items-center justify-center border"
                    style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <Text className="text-white font-semibold text-sm">Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleJoin}
                    disabled={joining}
                    className="flex-1 h-11 rounded-xl items-center justify-center"
                    style={{ backgroundColor: '#1E7A3A' }}
                  >
                    {joining ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text className="text-white font-bold text-sm">Rejoindre</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Pending notice — seulement avant l'envoi de la demande. */}
        {team && !pendingRequest && (
          <View className="flex-row items-center gap-2 mt-4 px-1">
            <Text style={{ color: '#F7921E', fontSize: 12 }}>⏳</Text>
            <Text className="text-xs flex-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Ta demande sera envoyée au capitaine. Statut :{' '}
              <Text style={{ color: '#F7921E', fontWeight: '700' }}>En attente de validation.</Text>
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
