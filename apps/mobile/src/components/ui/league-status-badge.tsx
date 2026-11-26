import { View, Text } from 'react-native';

/**
 * Badge de statut de ligue — source unique du libellé et des couleurs (L2).
 * Inscriptions ouvertes : fond vert ; closes : fond rouge ; autres statuts :
 * fond neutre sombre. Le libellé est en casse normale, jamais la constante
 * brute (`INSCRIPTIONS_OUVERTES`…).
 */
export const LEAGUE_STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon',
  INSCRIPTIONS_OUVERTES: 'Inscriptions ouvertes',
  INSCRIPTIONS_CLOSES: 'Inscriptions closes',
  EN_COURS: 'En cours',
  SUSPENDUE: 'Suspendue',
  TERMINÉE: 'Terminée',
  ARCHIVÉE: 'Archivée',
};

export function leagueStatusLabel(status: string): string {
  return LEAGUE_STATUS_LABEL[status] ?? status;
}

export function leagueStatusBadgeBg(status: string): string {
  if (status === 'INSCRIPTIONS_OUVERTES') return '#1E7A3A';
  if (status === 'INSCRIPTIONS_CLOSES') return '#DC2626';
  return '#0F3D1E';
}

export function LeagueStatusBadge({ status }: { status: string }) {
  return (
    <View
      className="self-start px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: leagueStatusBadgeBg(status) }}
    >
      <Text className="text-xs font-bold text-white">{leagueStatusLabel(status)}</Text>
    </View>
  );
}
