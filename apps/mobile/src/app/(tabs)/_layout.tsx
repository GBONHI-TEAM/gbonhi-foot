import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const TAB_ITEMS = [
  { name: 'index', title: 'Accueil', icon: '🏠' },
  { name: 'league', title: 'League', icon: '🏆' },
  { name: 'community', title: 'Communauté', icon: '💬' },
  { name: 'match', title: 'Match', icon: '⚽' },
  { name: 'profile', title: 'Profil', icon: '👤' },
] as const;

export default function TabsLayout() {
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
      {TAB_ITEMS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 20, color }}>{icon}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
