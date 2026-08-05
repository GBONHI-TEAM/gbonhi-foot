import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useUserModeStore } from '../../store/user-mode.store';
import { apiClient } from '../../lib/api';
import { PendingReservationCart, useReservationCartStore } from '../../store/reservation-cart.store';

export default function TabsLayout() {
  const mode = useUserModeStore((state) => state.mode);
  const isReservation = mode === 'reservation';
  const pendingReservation = useReservationCartStore((state) => state.pendingReservation);
  const setPendingReservation = useReservationCartStore((state) => state.setPendingReservation);

  useEffect(() => {
    if (!isReservation) {
      setPendingReservation(null);
      return;
    }

    let mounted = true;
    apiClient
      .get<PendingReservationCart | null>('/api/v1/reservations/mine/pending')
      .then(({ data }) => {
        if (mounted) setPendingReservation(data);
      })
      .catch(() => {
        // L'écran Panier affichera son erreur détaillée si l'utilisateur
        // l'ouvre ; on ne perturbe pas toute la navigation pour un badge.
      });
    return () => { mounted = false; };
  }, [isReservation, setPendingReservation]);

  const icon = (name: React.ComponentProps<typeof Ionicons>['name']) => ({ color }: { color: string }) => (
    <Ionicons name={name} size={22} color={color} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0B2E17',
          borderTopColor: 'rgba(255,255,255,0.06)',
          height: 66,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#2E9E4F',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="league" options={{ title: 'League', tabBarIcon: icon('trophy-outline'), href: isReservation ? null : undefined }} />
      <Tabs.Screen name="community" options={{ title: 'Communauté', tabBarIcon: icon('chatbubble-ellipses-outline') }} />
      <Tabs.Screen name="match" options={{ title: 'Match', tabBarIcon: icon('football-outline'), href: isReservation ? null : undefined }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Mon panier',
          tabBarIcon: icon('cart-outline'),
          tabBarBadge: pendingReservation ? '1' : undefined,
          href: isReservation ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
