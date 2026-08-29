import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../components/ui/screen-background';
import { PatternedGreenHeader } from '../../components/ui/patterned-green-header';
import { RemoteImage } from '../../components/ui/remote-image';
import { imageThumb } from '../../lib/image';
import { apiClient } from '../../lib/api';
import { teamInitials } from '../../types/match';

interface PlayerCard {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  position: string | null;
  city: string | null;
  bio: string | null;
  current_team: { id: string; name: string; logo_url: string | null; primary_color: string | null } | null;
  player_profile: {
    birth_date: string | null;
    height_cm: string | null;
    weight_kg: string | null;
    preferred_foot: string | null;
    secondary_position: string | null;
    level: string | null;
  } | null;
  statistics: { matches_played: number; goals: number; assists: number; yellow_cards: number; red_cards: number } | null;
}

function footLabel(v?: string | null): string | null {
  if (v === 'left') return 'Gauche';
  if (v === 'right') return 'Droit';
  if (v === 'both') return 'Ambidextre';
  return v ?? null;
}

function ageFrom(birth?: string | null): string | null {
  if (!birth) return null;
  // Formats tolérés : jj/mm/aaaa ou ISO.
  const m = birth.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const md = now.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age--;
  return age > 0 && age < 120 ? `${age} ans` : null;
}

export default function PlayerCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get<PlayerCard>(`/api/v1/users/${id}/card`);
      setCard(data);
    } catch {
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const st = card?.statistics ?? { matches_played: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
  const pp = card?.player_profile;
  const attrs: { label: string; value: string }[] = [];
  if (card?.position) attrs.push({ label: 'Poste', value: card.position });
  if (pp?.secondary_position) attrs.push({ label: 'Poste secondaire', value: pp.secondary_position });
  if (footLabel(pp?.preferred_foot)) attrs.push({ label: 'Pied fort', value: footLabel(pp?.preferred_foot)! });
  if (pp?.level) attrs.push({ label: 'Niveau', value: pp.level });
  if (pp?.height_cm) attrs.push({ label: 'Taille', value: `${pp.height_cm} cm` });
  if (pp?.weight_kg) attrs.push({ label: 'Poids', value: `${pp.weight_kg} kg` });
  if (ageFrom(pp?.birth_date)) attrs.push({ label: 'Âge', value: ageFrom(pp?.birth_date)! });

  return (
    <ScreenBackground>
      <PatternedGreenHeader style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }} patternOpacity={0.5}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/match'))} hitSlop={8}>
          <Text className="text-white text-2xl">←</Text>
        </Pressable>
        <Text className="text-white font-black text-lg mt-2">Carte de joueur</Text>
      </PatternedGreenHeader>

      {loading ? (
        <View className="flex-1 items-center justify-center py-24"><ActivityIndicator color="#F7921E" /></View>
      ) : !card ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white/50 text-sm text-center">Joueur introuvable.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* En-tête identité */}
          <View className="items-center">
            <View className="w-28 h-28 rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: '#0F3D1E', borderWidth: 3, borderColor: '#F7921E' }}>
              {card.avatar_url ? (
                <RemoteImage uri={imageThumb(card.avatar_url, 240)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text className="text-white font-black text-2xl">{teamInitials(card.full_name ?? '??')}</Text>
              )}
            </View>
            <Text className="text-white font-black text-2xl mt-3 text-center">{card.full_name ?? 'Joueur'}</Text>
            <Text className="text-white/60 text-sm mt-1">
              {[card.position, card.current_team?.name, card.city].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {/* Stats */}
          <View className="flex-row gap-2.5 mt-6">
            {[
              { label: 'Buts', value: st.goals },
              { label: 'Passes', value: st.assists },
              { label: 'Matchs', value: st.matches_played },
            ].map((s) => (
              <View key={s.label} className="flex-1 items-center rounded-2xl py-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <Text className="font-black text-3xl" style={{ color: '#FFB830' }}>{s.value}</Text>
                <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Cartons */}
          <View className="flex-row gap-2.5 mt-2.5">
            <View className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <View style={{ width: 12, height: 16, borderRadius: 2, backgroundColor: '#EAB308' }} />
              <Text className="text-white/80 text-sm font-semibold">{st.yellow_cards} jaune{st.yellow_cards > 1 ? 's' : ''}</Text>
            </View>
            <View className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <View style={{ width: 12, height: 16, borderRadius: 2, backgroundColor: '#DC2626' }} />
              <Text className="text-white/80 text-sm font-semibold">{st.red_cards} rouge{st.red_cards > 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Attributs sportifs */}
          {attrs.length > 0 && (
            <View className="mt-5">
              <Text className="text-white font-bold text-sm mb-2">Profil sportif</Text>
              <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                {attrs.map((a, i) => (
                  <View key={a.label} className="flex-row items-center justify-between px-4 py-3" style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                    <Text className="text-white/55 text-sm">{a.label}</Text>
                    <Text className="text-white font-semibold text-sm">{a.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {card.bio ? (
            <View className="mt-5">
              <Text className="text-white font-bold text-sm mb-2">À propos</Text>
              <Text className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{card.bio}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenBackground>
  );
}
