import { View, Text, Pressable, Share, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { teamInviteLink } from '../../lib/api';

export default function TeamSuccessPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; name?: string }>();
  const invitationCode = params.code?.trim() ? params.code : '—';
  const teamName = params.name?.trim() ? params.name : 'Ton équipe';
  const hasCode = !!params.code?.trim();
  const joinLink = hasCode ? teamInviteLink(invitationCode) : '';

  async function shareCode() {
    if (!hasCode) return;
    await Share.share({ message: `⚽ Rejoins ${teamName} sur GBONHI FOOT !\n\nCode d'invitation : ${invitationCode}\n\nOuvre ou télécharge l'application pour rejoindre l'équipe 👇\n${joinLink}` });
  }

  async function shareLink() {
    if (!hasCode) return;
    await Share.share({ message: `⚽ ${teamName} t'attend sur GBONHI FOOT !\n\nRejoins l'équipe directement dans l'application 👇\n${joinLink}\n\nCode d'invitation : ${invitationCode}` });
  }

  return (
    <ImageBackground
      source={require('../../../assets/images/kente-green.png')}
      resizeMode="repeat"
      style={{ flex: 1, backgroundColor: '#0F3D1E' }}
      imageStyle={{ opacity: 0.38 }}
    >
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(13,31,13,0.78)' }}>
      {/* Success animation placeholder */}
      <View
        className="w-24 h-24 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: 'rgba(30,122,58,0.25)', borderWidth: 2, borderColor: '#1E7A3A' }}
      >
        <Text style={{ fontSize: 44 }}>✅</Text>
      </View>

      <Text className="text-white font-black text-2xl text-center mb-2">
        Équipe créée !
      </Text>
      <Text className="text-center text-sm mb-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
        Tu es maintenant capitaine. Partage le code d&apos;invitation à tes coéquipiers pour qu&apos;ils te rejoignent.
      </Text>

      {/* Invitation code card */}
      <View
        className="w-full rounded-2xl p-6 items-center mb-8"
        style={{ backgroundColor: 'rgba(30,122,58,0.15)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.35)' }}
      >
        <Text className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Code d&apos;invitation
        </Text>
        <Text
          className="font-black text-4xl tracking-[0.2em] mb-4"
          style={{ color: '#F7921E' }}
        >
          {invitationCode}
        </Text>
        <View className="flex-row gap-2.5">
          <Pressable
            onPress={shareCode}
            className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: 'rgba(247,146,30,0.15)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.3)' }}
          >
            <Text style={{ color: '#F7921E', fontSize: 14 }}>#️⃣</Text>
            <Text className="text-sm font-semibold" style={{ color: '#F7921E' }}>Partager le code</Text>
          </Pressable>
          <Pressable
            onPress={shareLink}
            className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: 'rgba(30,122,58,0.25)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.5)' }}
          >
            <Text style={{ color: '#4ADE80', fontSize: 14 }}>🔗</Text>
            <Text className="text-sm font-semibold" style={{ color: '#4ADE80' }}>Partager le lien</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => router.replace('/(tabs)')}
        className="w-full h-14 rounded-2xl items-center justify-center"
        style={{ backgroundColor: '#1E7A3A' }}
      >
        <Text className="text-white font-bold text-base">Aller à l&apos;accueil</Text>
      </Pressable>
      </View>
    </ImageBackground>
  );
}
