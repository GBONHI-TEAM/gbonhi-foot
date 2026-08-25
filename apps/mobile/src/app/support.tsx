import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenBackground } from '../components/ui/screen-background';
import { AppHeader } from '../components/ui/app-header';
import { apiClient } from '../lib/api';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  category: string | null;
  response: string | null;
  created_at: string;
}

const CATEGORIES = ['Compte', 'Paiement', 'Équipe', 'Ligue', 'Match', 'Terrain', 'Autre'];
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ouvert: { label: 'Ouvert', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
  en_cours: { label: 'En cours', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  resolu: { label: 'Résolu', color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' },
  ferme: { label: 'Fermé', color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.08)' },
};

export default function SupportScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Formulaire
  const [category, setCategory] = useState('Compte');
  const [catOpen, setCatOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Ticket[]>('/api/v1/support/tickets/mine');
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function submit() {
    if (subject.trim().length < 3 || message.trim().length < 3) {
      Alert.alert('Champs requis', 'Renseigne un sujet et un message (3 caractères min).');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/api/v1/support/tickets', {
        kind: 'support',
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject('');
      setMessage('');
      setCreating(false);
      await load();
      Alert.alert('Ticket envoyé', 'Notre équipe te répondra ici et par notification.');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('Envoi impossible', Array.isArray(msg) ? msg.join('\n') : msg ?? 'Réessaie plus tard.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenBackground>
      <AppHeader
        title="Aide & Support"
        subtitle="Une question, un problème ?"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        actions={
          <Pressable onPress={() => setCreating((v) => !v)} accessibilityLabel="Nouveau ticket" style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{creating ? 'Fermer' : '+ Nouveau'}</Text>
          </Pressable>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {/* Formulaire de création */}
          {creating && (
            <View className="rounded-2xl p-4 mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(247,146,30,0.3)' }}>
              <Text className="text-white font-bold text-sm mb-3">Nouveau ticket</Text>

              <Text className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Catégorie</Text>
              <Pressable onPress={() => setCatOpen((o) => !o)} className="h-11 px-4 rounded-xl flex-row items-center justify-between mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                <Text className="text-white text-sm">{category}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)' }}>▾</Text>
              </Pressable>
              {catOpen && (
                <View className="rounded-xl mb-2 overflow-hidden" style={{ backgroundColor: 'rgba(30,122,58,0.95)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  {CATEGORIES.map((c) => (
                    <Pressable key={c} onPress={() => { setCategory(c); setCatOpen(false); }} className="px-4 py-3 border-b" style={{ borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                      <Text className="text-white text-sm">{c}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text className="text-xs mb-1.5 mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Sujet</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Ex. Problème d'inscription en ligue"
                placeholderTextColor="rgba(255,255,255,0.3)"
                className="h-11 px-4 rounded-xl text-white text-sm mb-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
              />

              <Text className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Décris ta demande en détail…"
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                className="px-4 py-3 rounded-xl text-white text-sm mb-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', height: 110, textAlignVertical: 'top' }}
              />

              <Pressable onPress={submit} disabled={submitting} className="h-12 rounded-xl items-center justify-center" style={{ backgroundColor: '#F7921E', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-sm">Envoyer le ticket</Text>}
              </Pressable>
            </View>
          )}

          {/* Liste de mes tickets */}
          <Text className="text-white font-bold text-sm mb-3">Mes demandes</Text>
          {loading ? (
            <View className="py-10 items-center"><ActivityIndicator color="#F7921E" /></View>
          ) : tickets.length === 0 ? (
            <View className="py-10 items-center px-6">
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🛟</Text>
              <Text className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Aucune demande pour l&apos;instant. Touche « + Nouveau » pour nous écrire.
              </Text>
            </View>
          ) : (
            tickets.map((t) => {
              const st = STATUS_META[t.status] ?? STATUS_META.ouvert;
              return (
                <View key={t.id} className="rounded-2xl p-4 mb-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-white font-bold text-sm flex-1 mr-2" numberOfLines={1}>{t.subject}</Text>
                    <View className="px-2.5 py-0.5 rounded-full" style={{ backgroundColor: st.bg }}>
                      <Text className="text-xs font-semibold" style={{ color: st.color }}>{st.label}</Text>
                    </View>
                  </View>
                  {t.category ? <Text className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.category}</Text> : null}
                  <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }} numberOfLines={3}>{t.message}</Text>
                  {t.response ? (
                    <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(30,122,58,0.15)', borderWidth: 1, borderColor: 'rgba(30,122,58,0.3)' }}>
                      <Text className="text-xs font-bold mb-1" style={{ color: '#4ADE80' }}>Réponse du support</Text>
                      <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.response}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
