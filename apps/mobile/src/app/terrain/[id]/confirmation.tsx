import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../../lib/api';
import { formatFcfa } from '../../../types/terrain';

interface PaymentStatus {
  status: 'pending' | 'processing' | 'accepted' | 'refused' | 'cancelled';
  amount: number;
  payment_method?: string | null;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return globalThis.btoa(binary);
}

export default function ConfirmationPage() {
  const { reservationId, total, method } = useLocalSearchParams<{ reservationId: string; total: string; method?: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadPayment = useCallback(async () => {
    if (!reservationId) return;
    try {
      const { data } = await apiClient.get<PaymentStatus>(`/api/v1/payments/reservations/${reservationId}`);
      setPayment(data);
    } catch {
      setPayment(null);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    void loadPayment();
    const interval = setInterval(() => { void loadPayment(); }, 5000);
    return () => clearInterval(interval);
  }, [loadPayment]);

  async function downloadReceipt() {
    if (!reservationId || payment?.status !== 'accepted') return;
    try {
      setDownloading(true);
      // Ces modules natifs ne doivent être chargés que lorsque l'utilisateur
      // télécharge réellement un reçu. Cela laisse notamment la fiche joueur
      // utilisable dans un client Expo qui n'a pas encore été reconstruit.
      const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      const response = await apiClient.get<ArrayBuffer>(`/api/v1/payments/reservations/${reservationId}/receipt.pdf`, { responseType: 'arraybuffer' });
      if (!FileSystem.documentDirectory) throw new Error('Dossier de téléchargement indisponible');
      const uri = `${FileSystem.documentDirectory}gbonhi-foot-recu-${reservationId}.pdf`;
      await FileSystem.writeAsStringAsync(uri, toBase64(response.data), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Reçu GBONHI FOOT' });
      } else {
        Alert.alert('Reçu téléchargé', `Le reçu a été enregistré dans : ${uri}`);
      }
    } catch {
      Alert.alert('Téléchargement impossible', 'Réessaie dans quelques instants.');
    } finally {
      setDownloading(false);
    }
  }

  const accepted = payment?.status === 'accepted';
  const refused = payment?.status === 'refused' || payment?.status === 'cancelled';
  const isCash = (payment?.payment_method ?? method) === 'cash';
  const amount = payment?.amount ?? Number(total);
  const title = accepted ? 'Réservation confirmée !' : refused ? 'Paiement non finalisé' : 'Paiement en attente';
  const body = accepted
    ? isCash
      ? 'Ta réservation est confirmée. Règle en espèces sur place au partenaire.'
      : 'Ton paiement est validé. Ta réservation est confirmée.'
    : refused
      ? 'Le paiement a été refusé ou annulé. Tu peux choisir un autre créneau et réessayer.'
      : 'Nous vérifions la validation de ton paiement. Cette page se met à jour automatiquement.';

  return (
    <ImageBackground
      source={require('../../../../assets/images/kente-green.png')}
      resizeMode="repeat"
      style={{ flex: 1, backgroundColor: '#0F3D1E' }}
      imageStyle={{ opacity: 0.38 }}
    >
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(13,31,13,0.78)' }}>
        <View className="w-28 h-28 rounded-full items-center justify-center mb-8" style={{ backgroundColor: accepted ? '#2E9E4F' : refused ? '#B9383E' : '#F7921E' }}>
          {loading || (!accepted && !refused) ? <ActivityIndicator color="#FFFFFF" size="large" /> : <Text className="text-white" style={{ fontSize: 56 }}>{accepted ? '✓' : '!'}</Text>}
        </View>
        <Text className="text-white font-black text-3xl text-center">{title}</Text>
        <Text className="text-white/65 text-base text-center mt-3 leading-relaxed">{body}</Text>

        <View className="w-full rounded-card p-4 mt-8" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-white/55 text-sm">Montant</Text>
            <Text className="text-white font-bold text-base">{formatFcfa(amount)}</Text>
          </View>
          <View className="h-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View className="flex-row items-center justify-between">
            <Text className="text-white/55 text-sm">Statut paiement</Text>
            <Text className="font-bold text-sm" style={{ color: accepted ? '#4ADE80' : refused ? '#F87171' : '#F7921E' }}>
              {accepted ? (isCash ? 'À régler sur place' : 'Validé') : refused ? 'Refusé' : 'Vérification en cours'}
            </Text>
          </View>
        </View>
      </View>

      <View className="px-8 pb-10" style={{ backgroundColor: 'rgba(13,31,13,0.78)' }}>
        {accepted ? (
          <Pressable onPress={downloadReceipt} disabled={downloading} className="h-14 rounded-btn flex-row items-center justify-center gap-2" style={{ backgroundColor: '#F7921E', opacity: downloading ? 0.6 : 1 }}>
            {downloading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={{ fontSize: 16 }}>📥</Text><Text className="text-white font-bold text-base">Télécharger le reçu PDF</Text></>}
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.replace(reservationId ? `/reservation/${reservationId}` : '/(tabs)')} className="h-14 rounded-btn items-center justify-center mt-3" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}>
          <Text className="text-white font-semibold text-base">Voir ma réservation</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} className="h-11 items-center justify-center mt-3">
          <Text className="text-white/70 text-sm font-semibold">Retour à l&apos;accueil</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}
