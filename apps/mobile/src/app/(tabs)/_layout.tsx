import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useUserModeStore } from '../../store/user-mode.store';
import { apiClient } from '../../lib/api';
import { PendingReservationCart, useReservationCartStore } from '../../store/reservation-cart.store';

export default function TabsLayout() {
  const mode = useUserModeStore((state) => state.mode);
  const isReservation = mode === 'reservation';
  const pendingReservations = useReservationCartStore((state) => state.pendingReservations);
  const setPendingReservations = useReservationCartStore((state) => state.setPendingReservations);

  useEffect(() => {
    if (!isReservation) {
      setPendingReservations(null);
      return;
    }

    let mounted = true;
    apiClient
      .get<PendingReservationCart[]>('/api/v1/reservations/mine/cart')
      .then(({ data }) => {
        if (mounted) setPendingReservations(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // L'écran Panier affichera son erreur détaillée si l'utilisateur
        // l'ouvre ; on ne perturbe pas toute la navigation pour un badge.
      });
    return () => { mounted = false; };
  }, [isReservation, setPendingReservations]);

  const cartCount = pendingReservations.length;

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
      <Tabs.Screen name="league" options={{ title: 'Ligues', tabBarIcon: icon('trophy-outline'), href: isReservation ? null : undefined }} />
      <Tabs.Screen name="community" options={{ title: 'Communauté', tabBarIcon: icon('chatbubble-ellipses-outline') }} />
      <Tabs.Screen name="match" options={{ title: 'Match', tabBarIcon: icon('football-outline'), href: isReservation ? null : undefined }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Mon panier',
          tabBarIcon: icon('cart-outline'),
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          href: isReservation ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
