import { useState } from 'react';
import { View, Text, Pressable, Share, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { copyToClipboard } from '../../lib/clipboard';
import { teamInviteLink } from '../../lib/api';
import { buildTeamInviteMessage } from '../../lib/team-invite';

export default function TeamSuccessPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; name?: string }>();
  const invitationCode = params.code?.trim() ? params.code : '—';
  const teamName = params.name?.trim() ? params.name : 'Ton équipe';
  const hasCode = !!params.code?.trim();
  const joinLink = hasCode ? teamInviteLink(invitationCode) : '';
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!hasCode) return;
    const ok = await copyToClipboard(invitationCode);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function shareLink() {
    if (!hasCode) return;
    await Share.share({ message: buildTeamInviteMessage(teamName, invitationCode, joinLink) });
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
        <Text className="text-base font-bold mb-3 text-center" style={{ color: '#FFFFFF' }}>
          Inviter des joueurs
        </Text>
        {/* Code copiable au long-press */}
        <Pressable onPress={copyCode} onLongPress={copyCode} className="items-center">
          <Text className="font-black text-4xl tracking-[0.2em]" style={{ color: '#F7921E' }}>
            {invitationCode}
          </Text>
          <Text className="text-xs mt-2" style={{ color: copied ? '#4ADE80' : 'rgba(255,255,255,0.5)' }}>
            {copied ? '✓ Code copié !' : 'Maintiens le code pour le copier'}
          </Text>
        </Pressable>
        <Pressable
          onPress={shareLink}
          className="flex-row items-center justify-center gap-2 px-5 py-3 rounded-xl mt-5 w-full"
          style={{ backgroundColor: 'rgba(30,122,58,0.3)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.55)' }}
        >
          <Text style={{ color: '#4ADE80', fontSize: 15 }}>🔗</Text>
          <Text className="text-sm font-bold" style={{ color: '#4ADE80' }}>Partager le lien</Text>
        </Pressable>
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
