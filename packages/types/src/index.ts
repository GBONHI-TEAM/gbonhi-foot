// ── Shared TypeScript types across mobile, admin, partner ──────────────────

export type UserRole = 'player' | 'admin' | 'partner' | 'referee';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain_id: string;
  league_id: string | null;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  organizer_id: string;
  format: 'league' | 'knockout' | 'group_knockout';
  status: 'draft' | 'registration' | 'ongoing' | 'finished';
  max_teams: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export type MatchStatus = 'upcoming' | 'live' | 'finished' | 'cancelled' | 'postponed';

export interface Match {
  id: string;
  tournament_id: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: MatchStatus;
  scheduled_at: string;
  venue: string | null;
}

export type MatchEventType = 'goal' | 'own_goal' | 'yellow_card' | 'red_card' | 'substitution';

export interface MatchEvent {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string | null;
  type: MatchEventType;
  minute: number;
}

export interface Terrain {
  id: string;
  partner_id: string;
  name: string;
  address: string;
  city: string;
  photos: string[];
  surface: 'grass' | 'artificial' | 'futsal';
  capacity: number;
  price_per_hour: number;
  amenities: string[];
  is_active: boolean;
}

export interface Reservation {
  id: string;
  terrain_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_ref: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
