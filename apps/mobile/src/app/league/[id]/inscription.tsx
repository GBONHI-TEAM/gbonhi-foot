import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, ImageBackground, Image, type ImageSourcePropType } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../components/ui/screen-background';
import { apiClient } from '../../../lib/api';
import { AppHeader } from '../../../components/ui/app-header';
import { RemoteImage } from '../../../components/ui/remote-image';
import { imageThumb } from '../../../lib/image';

interface League {
  id: string;
  name: string;
  status: string;
  level?: string | null;
  registration_fee?: number | null;
  prize_info?: string | null;
}
interface MyTeam { id: string; name: string; primary_color?: string | null; logo_url?: string | null }

// Habillage des moyens de paiement (identique au panier réservation).
const METHOD_META: Record<string, { logo?: ImageSourcePropType; fit?: 'cover' | 'contain'; emoji?: string; subtitle: string }> = {
  cash: { emoji: '💵', subtitle: 'À régler sur place' },
  wave: { logo: require('../../../../assets/images/pay-wave.png'), subtitle: 'Paiement mobile instantané' },
  orange: { logo: require('../../../../assets/images/pay-orange.webp'), subtitle: 'Orange Money' },
  mtn: { logo: require('../../../../assets/images/pay-mtn.png'), subtitle: 'MTN MoMo' },
  moov: { logo: require('../../../../assets/images/pay-moov.png'), fit: 'contain', subtitle: 'Moov Money' },
};
interface Registration {
  team: MyTeam;
  league_payment?: { id: string; amount: number; status: string; transaction_id: string } | null;
}
interface RegistrationState {
  teams: MyTeam[];
  registrations: Registration[];
  already_registered: boolean;
  registrations_open: boolean;
  league_full: boolean;
  participation?: { team: MyTeam } | null;
}

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
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [methods, setMethods] = useState<{ code: string; label: string }[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('cash');

  useEffect(() => {
    (async () => {
      const [l, state, pm] = await Promise.all([
        apiClient.get<League>(`/api/v1/leagues/${id}`).then((r) => r.data).catch(() => null),
        apiClient.get<RegistrationState>(`/api/v1/leagues/${id}/my-registration`).then((r) => r.data).catch(() => null),
        apiClient.get<{ code: string; label: string }[]>(`/api/v1/payments/methods`).then((r) => r.data).catch(() => null),
      ]);
      setLeague(l);
      setTeam(state?.participation?.team ?? state?.teams?.[0] ?? null);
      setRegistration(state?.registrations?.[0] ?? null);
      if (state?.already_registered) setDone(true);
      const list = Array.isArray(pm) && pm.length > 0 ? pm : [{ code: 'cash', label: 'Espèces' }];
      setMethods(list);
      setSelectedMethod((cur) => (list.some((m) => m.code === cur) ? cur : list[0].code));
      setLoading(false);
    })();
  }, [id]);

  async function handleRegister() {
    if (!team || !league) return;
    setSubmitting(true);
    try {
      const { data } = await apiClient.post<{ payment_id: string; status: 'accepted'; amount: number }>(`/api/v1/payments/leagues/${id}/checkout`, { team_id: team.id, payment_method: selectedMethod });
      setRegistration({ team, league_payment: { id: data.payment_id, amount: data.amount, status: data.status, transaction_id: '' } });
      setDone(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('Inscription impossible', Array.isArray(msg) ? msg.join('\n') : msg ?? "Réessaie plus tard.");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadReceipt() {
    const receiptTeam = registration?.team ?? team;
    if (!receiptTeam || !id) return;
    try {
      setDownloading(true);
      const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      const response = await apiClient.get<ArrayBuffer>(`/api/v1/payments/leagues/${id}/teams/${receiptTeam.id}/receipt.pdf`, { responseType: 'arraybuffer' });
      if (!FileSystem.documentDirectory) throw new Error('Dossier de téléchargement indisponible');
      const bytes = new Uint8Array(response.data);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      const uri = `${FileSystem.documentDirectory}gbonhi-foot-recu-ligue-${id}.pdf`;
      await FileSystem.writeAsStringAsync(uri, globalThis.btoa(binary), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Reçu d’inscription GBONHI FOOT' });
      } else {
        Alert.alert('Reçu téléchargé', `Le reçu a été enregistré dans : ${uri}`);
      }
    } catch {
      Alert.alert('Téléchargement impossible', 'Réessaie dans quelques instants.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F7921E" /></View>
      </ScreenBackground>
    );
  }

  const receiptAvailable = registration?.league_payment?.status === 'accepted';

  /* Confirmation */
  if (done) {
    return (
      <ImageBackground
        source={require('../../../../assets/images/kente-green.png')}
        resizeMode="repeat"
        style={{ flex: 1, backgroundColor: '#0F3D1E' }}
        imageStyle={{ opacity: 0.38 }}
      >
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(13,31,13,0.78)' }}>
        <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: '#1E7A3A' }}>
          <Text className="text-white text-4xl">✓</Text>
        </View>
        <Text className="text-white font-black text-2xl text-center mb-3">{registration ? 'Inscription confirmée !' : 'Déjà inscrit !'}</Text>
        <Text className="text-center text-sm mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <Text className="text-white font-semibold">{registration?.team.name ?? team?.name}</Text> est inscrite à{' '}
          <Text className="text-white font-semibold">{league?.name}</Text>.
        </Text>
        <View className="w-full rounded-xl p-3 mb-5" style={{ backgroundColor: receiptAvailable ? 'rgba(74,222,128,0.10)' : 'rgba(255,184,48,0.10)', borderWidth: 1, borderColor: receiptAvailable ? 'rgba(74,222,128,0.25)' : 'rgba(255,184,48,0.25)' }}>
          <Text className="text-center text-xs" style={{ color: receiptAvailable ? '#86EFAC' : '#FFB830' }}>
            {receiptAvailable ? '✓ Paiement simulé validé · reçu disponible' : 'Inscription historique : aucun reçu de paiement associé.'}
          </Text>
        </View>
        {receiptAvailable ? (
          <Pressable onPress={downloadReceipt} disabled={downloading} className="w-full h-14 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: '#F7921E', opacity: downloading ? 0.6 : 1 }}>
            {downloading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">📥 Télécharger le reçu PDF</Text>}
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.replace(`/league/${id}`)} className="w-full h-14 rounded-2xl items-center justify-center mb-3 border" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
          <Text className="text-white font-bold text-base">Voir la ligue</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} className="w-full h-12 rounded-2xl items-center justify-center border" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          <Text className="text-white font-semibold text-sm">Retour à l&apos;accueil</Text>
        </Pressable>
        </View>
      </ImageBackground>
    );
  }

  const fee = league?.registration_fee ?? 0;

  return (
    <ScreenBackground>
      <AppHeader title="Inscription en league" onBack={() => router.back()} showLogo={false} centered />

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
              <View className="w-11 h-11 rounded-xl items-center justify-center overflow-hidden" style={{ backgroundColor: team.primary_color?.trim() || '#1E7A3A' }}>
                {team.logo_url?.trim() ? (
                  <RemoteImage uri={imageThumb(team.logo_url, 120)} contentFit="cover" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text className="text-white font-black text-sm">{initials(team.name)}</Text>
                )}
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

        {/* Moyen de paiement */}
        {team ? (
          <View className="mb-4">
            <Text className="text-white font-bold text-base mb-2">Moyen de paiement</Text>
            {methods.map((m) => {
              const active = selectedMethod === m.code;
              const meta = METHOD_META[m.code] ?? { subtitle: 'Mobile Money' };
              return (
                <Pressable
                  key={m.code}
                  onPress={() => setSelectedMethod(m.code)}
                  className="flex-row items-center gap-3 rounded-btn p-3 mb-2.5"
                  style={{ borderWidth: 1.5, borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.12)', backgroundColor: active ? 'rgba(247,146,30,0.08)' : 'rgba(255,255,255,0.04)' }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    {meta.logo ? (
                      <Image source={meta.logo} style={{ width: 46, height: 46 }} resizeMode={meta.fit ?? 'cover'} />
                    ) : (
                      <Text style={{ fontSize: 22 }}>{meta.emoji ?? '💳'}</Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-base">{m.label}</Text>
                    <Text className="text-white/50 text-xs mt-0.5">{meta.subtitle}</Text>
                  </View>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? '#F7921E' : 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#F7921E' }} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

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

        <Text className="text-xs mt-3 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Le paiement simulé valide l&apos;inscription pour cette phase de test. Ton équipe ne sera jamais enregistrée sans règlement confirmé.
        </Text>
      </ScrollView>

      <View className="px-5 pb-8">
        <Pressable
          onPress={team ? handleRegister : () => router.push('/team')}
          disabled={submitting || (!!team && !accepted)}
          className="h-14 rounded-2xl items-center justify-center"
          style={{ backgroundColor: team ? '#1E7A3A' : '#F7921E', opacity: !!team && !accepted ? 0.4 : 1 }}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">{team ? 'Valider le paiement simulé' : 'Créer / rejoindre une équipe'}</Text>}
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
