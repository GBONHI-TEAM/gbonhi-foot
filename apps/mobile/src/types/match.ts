// Types partagés pour les écrans Matchs / Scores live (Phase 3).
// Alignés sur le backend NestJS (modules/matches, modules/leagues).

export type MatchStatus =
  | 'PROGRAMMÉ'
  | 'EN_COURS'
  | 'TERMINÉ'
  | 'VALIDÉ'
  | 'REPORTÉ'
  | 'ANNULÉ'
  | (string & {}); // tolérance : anciennes valeurs éventuelles ("upcoming"…)

export type MatchEventType =
  | 'BUT'
  | 'PASSE'
  | 'CARTON_JAUNE'
  | 'CARTON_ROUGE'
  | 'CSC'
  | 'BLESSURE'
  | (string & {});

export interface TeamRef {
  id: string;
  name: string;
  primary_color?: string | null;
  logo_url?: string | null;
}

export interface PlayerRef {
  id: string;
  full_name: string | null;
}

export interface TournamentRef {
  id: string;
  name: string;
}

export interface Match {
  id: string;
  home_team: TeamRef;
  away_team: TeamRef;
  home_score: number;
  away_score: number;
  status: MatchStatus;
  round: number | null;
  scheduled_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  venue: string | null;
  tournament?: TournamentRef | null;
}

export interface MatchEvent {
  id: string;
  type: MatchEventType;
  minute: number;
  note?: string | null;
  team: { id: string; name: string } | null;
  player: PlayerRef | null;
}

export interface MatchDetail extends Match {
  events: MatchEvent[];
}

export interface Standing {
  rank: number;
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export interface ScorerRow {
  player: PlayerRef | null;
  count: number;
}

export interface ScorersResponse {
  scorers: ScorerRow[];
  assisters: ScorerRow[];
}

// Ligue = tournoi côté backend.
export interface League {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  format?: string;
  max_teams: number;
  start_date: string;
  end_date: string;
  location?: string | null;
  banner_url?: string | null;
  prize_info?: string | null;
  level?: string | null;
  matches_per_team?: number | null;
  registration_fee?: number | null;
  rules?: string | null;
  rewards?: string | null;
  _count?: { teams: number; matches: number };
  organizer?: { id: string; full_name: string | null } | null;
}

// ─── Helpers d'affichage ────────────────────────────────────────────────────

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];

/** "Sam 15 fév" */
export function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "16h00" */
export function formatMatchTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}h${m}`;
}

/** Initiales d'une équipe pour la pastille (2 lettres). */
export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Couleur de pastille : primary_color de l'équipe ou vert par défaut. */
export function teamColor(team: TeamRef): string {
  return team.primary_color || '#1E7A3A';
}

export interface StatusMeta {
  label: string;
  color: string; // texte
  bg: string; // fond du badge
  live: boolean;
}

export function matchStatusMeta(status: MatchStatus): StatusMeta {
  switch (status) {
    case 'EN_COURS':
      return { label: 'EN DIRECT', color: '#FFFFFF', bg: '#E53935', live: true };
    case 'TERMINÉ':
      return { label: 'TERMINÉ', color: '#4ADE80', bg: 'rgba(30,122,58,0.3)', live: false };
    case 'VALIDÉ':
      return { label: 'VALIDÉ', color: '#4ADE80', bg: 'rgba(30,122,58,0.3)', live: false };
    case 'REPORTÉ':
      return { label: 'REPORTÉ', color: '#F7921E', bg: 'rgba(247,146,30,0.2)', live: false };
    case 'ANNULÉ':
      return { label: 'ANNULÉ', color: '#F87171', bg: 'rgba(220,38,38,0.2)', live: false };
    case 'PROGRAMMÉ':
    default:
      return { label: 'À VENIR', color: '#F7921E', bg: 'rgba(247,146,30,0.2)', live: false };
  }
}

/** Emoji associé à un type d'événement de match. */
export function eventIcon(type: MatchEventType): string {
  switch (type) {
    case 'BUT':
      return '⚽';
    case 'CSC':
      return '🥅';
    case 'PASSE':
      return '🅰️';
    case 'CARTON_JAUNE':
      return '🟨';
    case 'CARTON_ROUGE':
      return '🟥';
    case 'BLESSURE':
      return '🩹';
    default:
      return '•';
  }
}

/** Libellé lisible d'un type d'événement. */
export function eventLabel(type: MatchEventType): string {
  switch (type) {
    case 'BUT':
      return 'But';
    case 'CSC':
      return 'But contre son camp';
    case 'PASSE':
      return 'Passe décisive';
    case 'CARTON_JAUNE':
      return 'Carton jaune';
    case 'CARTON_ROUGE':
      return 'Carton rouge';
    case 'BLESSURE':
      return 'Blessure';
    default:
      return type;
  }
}

/** Un match est-il « à venir » (score non encore joué) ? */
export function isUpcoming(status: MatchStatus): boolean {
  return status === 'PROGRAMMÉ' || status === 'REPORTÉ';
}
