import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ImageBackground, Switch, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { ScreenBackground } from '../components/ui/screen-background';
import { AppHeader } from '../components/ui/app-header';

function Row({ icon, label, right, onPress, isLast }: { icon: string; label: string; right?: React.ReactNode; onPress?: () => void; isLast?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5"
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}
    >
      <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <Text className="text-white font-semibold text-[15px] flex-1">{label}</Text>
      {right}
    </Pressable>
  );
}

function SectionTitle({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <Text className="text-xs font-bold tracking-widest mb-2 mt-6" style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.4)' }}>
      {children}
    </Text>
  );
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>{children}</View>
);
const Chevron = () => <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>›</Text>;

const LANGUAGES = ['Français', 'English (bientôt)'] as const;

const CGU_TEXT = `Bienvenue sur GBONHI FOOT.

En utilisant l'application, tu acceptes les présentes conditions.

1. Compte — Tu es responsable de l'exactitude des informations de ton compte et de la confidentialité de tes accès.

2. Comportement — Les publications et échanges dans la communauté doivent rester respectueux. Tout contenu injurieux, haineux ou frauduleux peut être signalé et retiré.

3. Réservations & ligues — Les réservations de terrains et inscriptions en ligue sont soumises aux disponibilités et aux règles fixées par les partenaires et organisateurs.

4. Paiement — Les paiements en ligne (Wave, Orange Money, MTN MoMo, carte) sont opérés par des prestataires tiers. GBONHI FOOT n'stocke pas tes informations bancaires.

5. Données — Tes données sont utilisées uniquement pour le fonctionnement du service. Tu peux demander la suppression de ton compte à tout moment depuis les Paramètres.

6. Responsabilité — GBONHI FOOT met tout en œuvre pour assurer la continuité du service mais ne saurait être tenu responsable des interruptions ou des litiges entre utilisateurs.

Pour toute question, contacte-nous via Aide & Support.`;

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;

  const version = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  const [notifications, setNotifications] = useState<boolean>((meta.notifications_enabled as boolean | undefined) ?? true);
  const [language, setLanguage] = useState<string>((meta.language as string | undefined) ?? 'Français');

  const currentPhone = (meta.phone as string | undefined) ?? '';
  const [phoneModal, setPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState(currentPhone.replace(/^\+225/, ''));
  const [savingPhone, setSavingPhone] = useState(false);
  const [langModal, setLangModal] = useState(false);
  const [cguModal, setCguModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleNotifications(v: boolean) {
    setNotifications(v);
    try { await supabase.auth.updateUser({ data: { notifications_enabled: v } }); } catch { /* non bloquant */ }
  }

  async function savePhone() {
    const clean = phoneInput.replace(/\D/g, '');
    if (clean.length < 8) { Alert.alert('Numéro invalide', 'Saisis un numéro valide (au moins 8 chiffres).'); return; }
    const phone = `+225${clean}`;
    setSavingPhone(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { phone } });
      if (error) { Alert.alert('Erreur', error.message); return; }
      setPhoneModal(false);
      Alert.alert('Numéro mis à jour', `Ton nouveau numéro est le ${phone}.`);
    } finally {
      setSavingPhone(false);
    }
  }

  async function chooseLanguage(l: string) {
    if (l.includes('bientôt')) { setLangModal(false); Alert.alert('Bientôt', 'D\'autres langues arriveront prochainement.'); return; }
    setLanguage(l);
    setLangModal(false);
    try { await supabase.auth.updateUser({ data: { language: l } }); } catch { /* non bloquant */ }
  }

  async function signOut() { await supabase.auth.signOut(); }

  function deleteAccount() {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Tes réservations, participations et données personnelles seront supprimées. Si tu es capitaine avec des membres, partenaire ou organisateur, transfère d’abord tes responsabilités. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement', style: 'destructive', onPress: async () => {
            setDeleting(true);
            try {
              await apiClient.delete('/api/v1/users/me');
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            } catch (e: unknown) {
              const raw = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
              const message = Array.isArray(raw) ? raw.join('\n') : raw ?? 'Réessaie dans quelques instants.';
              // Si le blocage concerne le capitanat, on propose d'aller gérer l'équipe.
              if (/capitan|capitaine|équipe/i.test(message)) {
                Alert.alert('Transfère d’abord ton capitanat', message, [
                  { text: 'Plus tard', style: 'cancel' },
                  { text: 'Gérer mon équipe', onPress: () => router.push('/team') },
                ]);
              } else {
                Alert.alert('Suppression impossible', message);
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <ScreenBackground>
      <AppHeader title="Paramètres" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} showLogo={false} centered />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Compte */}
        <SectionTitle>COMPTE</SectionTitle>
        <Card>
          <Row icon="👤" label="Modifier le profil" right={<Chevron />} onPress={() => router.push('/account-profile')} />
          <Row
            icon="📱"
            label="Changer de numéro"
            right={<View className="flex-row items-center gap-1.5">{currentPhone ? <Text className="text-white/50 text-sm">{currentPhone}</Text> : null}<Chevron /></View>}
            onPress={() => { setPhoneInput(currentPhone.replace(/^\+225/, '')); setPhoneModal(true); }}
          />
          <Row
            icon="🔔"
            label="Notifications"
            isLast
            right={<Switch value={notifications} onValueChange={toggleNotifications} trackColor={{ true: '#1E7A3A', false: 'rgba(255,255,255,0.2)' }} thumbColor="#fff" />}
          />
        </Card>

        {/* Application */}
        <SectionTitle>APPLICATION</SectionTitle>
        <Card>
          <Row icon="🔄" label="Changer de mode" right={<Chevron />} onPress={() => router.push('/(auth)/mode-selection')} />
          <Row icon="🌍" label="Langue" right={<View className="flex-row items-center gap-1.5"><Text className="text-white/50 text-sm">{language}</Text><Chevron /></View>} onPress={() => setLangModal(true)} />
          <Row icon="ℹ️" label="À propos" right={<Chevron />} onPress={() => Alert.alert('GBONHI FOOT', `Le football amateur ivoirien.\nVersion ${version}`)} />
          <Row icon="📄" label="Conditions d'utilisation" isLast right={<Chevron />} onPress={() => setCguModal(true)} />
        </Card>

        {/* Déconnexion / suppression de compte */}
        <View className="mt-6 rounded-2xl p-3" style={{ borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' }}>
          <Pressable onPress={signOut} className="h-14 rounded-xl items-center justify-center mb-3" style={{ borderWidth: 1, borderColor: 'rgba(248,113,113,0.6)' }}>
            <Text className="font-bold text-base" style={{ color: '#F87171' }}>Se déconnecter</Text>
          </Pressable>
          <Pressable onPress={deleteAccount} disabled={deleting} className="h-14 rounded-xl items-center justify-center" style={{ backgroundColor: '#EF4444', opacity: deleting ? 0.6 : 1 }}>
            {deleting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Supprimer mon compte</Text>}
          </Pressable>
        </View>

        <Text className="text-white/35 text-xs text-center mt-6">GBONHI FOOT · Version {version}</Text>
      </ScrollView>

      {/* Modal — Changer de numéro */}
      <Modal visible={phoneModal} transparent animationType="fade" onRequestClose={() => setPhoneModal(false)}>
        <Pressable onPress={() => setPhoneModal(false)} className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-2xl p-5" style={{ backgroundColor: '#0D1F0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Text className="text-white font-bold text-base mb-4">Changer de numéro</Text>
            <View className="flex-row items-center h-12 rounded-xl px-4" style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
              <Text className="text-white font-bold mr-2">+225</Text>
              <View style={{ width: 1, height: '55%', backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 12 }} />
              <TextInput value={phoneInput} onChangeText={setPhoneInput} keyboardType="phone-pad" placeholder="0700000000" placeholderTextColor="rgba(255,255,255,0.3)" className="flex-1 text-white text-base" />
            </View>
            <View className="flex-row gap-3 mt-5">
              <Pressable onPress={() => setPhoneModal(false)} className="flex-1 h-12 rounded-xl items-center justify-center" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text className="text-white font-semibold text-sm">Annuler</Text>
              </Pressable>
              <Pressable onPress={savePhone} disabled={savingPhone} className="flex-1 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: '#F7921E', opacity: savingPhone ? 0.6 : 1 }}>
                {savingPhone ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-sm">Enregistrer</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal — Langue */}
      <Modal visible={langModal} transparent animationType="fade" onRequestClose={() => setLangModal(false)}>
        <Pressable onPress={() => setLangModal(false)} className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-2xl p-5" style={{ backgroundColor: '#0D1F0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Text className="text-white font-bold text-base mb-3">Langue</Text>
            {LANGUAGES.map((l) => {
              const active = language === l;
              return (
                <Pressable key={l} onPress={() => chooseLanguage(l)} className="flex-row items-center justify-between py-3.5 px-2 rounded-xl">
                  <Text className="text-white text-base" style={{ opacity: l.includes('bientôt') ? 0.5 : 1 }}>{l}</Text>
                  {active ? <Text style={{ color: '#4ADE80', fontSize: 16 }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal — Conditions d'utilisation */}
      <Modal visible={cguModal} transparent animationType="slide" onRequestClose={() => setCguModal(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View className="rounded-t-3xl" style={{ backgroundColor: '#0D1F0D', maxHeight: '85%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="text-white font-black text-lg">Conditions d&apos;utilisation</Text>
              <Pressable onPress={() => setCguModal(false)} hitSlop={8}><Text className="text-white text-2xl">✕</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
              <Text className="text-white/75 text-sm leading-6">{CGU_TEXT}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}
