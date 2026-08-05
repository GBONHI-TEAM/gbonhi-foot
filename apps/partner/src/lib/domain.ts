// Types & helpers partagés du Portail Partenaire — reflètent les endpoints backend
// GBONHI FOOT (/api/v1). Utilisés par les 6 écrans du dashboard partenaire.

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface ApiSlot {
  id: string;
  day_of_week: number; // 0 = Lundi … 6 = Dimanche
  start_hour: number;
  end_hour: number;
  is_active: boolean;
}

export interface ApiBlock {
  id: string;
  blocked_date: string; // YYYY-MM-DD
  start_hour: number | null;
  end_hour: number | null;
  reason: string | null;
}

export interface ApiTerrain {
  id: string;
  name: string;
  address: string;
  city: string;
  surface: string; // ex: 'artificial'
  format: string; // ex: '5vs5'
  capacity: number;
  price_per_hour: number;
  amenities: string[];
  description: string | null;
  phone_contact: string | null;
  is_active: boolean;
  slots?: ApiSlot[];
  blocks?: ApiBlock[];
  _count?: { reservations: number; reviews?: number };
  rating_avg?: number; // note moyenne (ex: 4.3)
  rating_count?: number; // nombre d'avis
}

export interface ApiReview {
  id: string;
  rating: number; // 1-5
  comment: string | null;
  created_at: string;
  user: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface ApiReservation {
  id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  duration_hours: number;
  unit_price: number;
  total_price: number;
  platform_fee: number;
  partner_amount: number;
  status: ReservationStatus;
  notes: string | null;
  terrain: { id: string; name: string; city: string };
  user: { id: string; full_name: string; avatar_url: string | null } | null;
  payment: { status: string; payment_method: string; amount: number } | null;
}

export interface ApiUser {
  id: string;
  full_name: string | null;
  username: string | null;
  email?: string | null;
  avatar_url: string | null;
  role: string;
  city: string | null;
}

export interface ApiReservationStats {
  today_count: number;
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  occupancy_rate: number;
  total_reservations: number;
}

/** Indicateurs d'exploitation non financiers, accessibles aux gérants. */
export interface ApiOperationalStats {
  today_count: number;
  occupancy_rate: number;
  total_reservations: number;
}

/** Libellés FR des statuts de réservation. */
export const STATUS_FR: Record<ReservationStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  completed: 'Terminée',
  no_show: 'Absent',
};

/** Badge (fond + texte) par libellé FR de statut. */
export const STATUS_BADGE_FR: Record<string, { bg: string; color: string }> = {
  Terminée: { bg: '#D1FAE5', color: '#065F46' },
  Confirmée: { bg: '#DBEAFE', color: '#1D4ED8' },
  'En attente': { bg: '#FEF3C7', color: '#92400E' },
  Annulée: { bg: '#FEE2E2', color: '#B91C1C' },
  Absent: { bg: '#F3F4F6', color: '#6B7280' },
};

export const JOURS_FR = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

export const SURFACE_FR: Record<string, string> = {
  artificial: 'Synthétique',
  natural: 'Naturel',
  indoor: 'Indoor',
};

/** Rôle FR lisible pour l'utilisateur connecté. */
export const ROLE_FR: Record<string, string> = {
  partner: 'Propriétaire',
  owner: 'Propriétaire',
  manager: 'Gérant',
  admin: 'Administrateur',
};

/** Nom affiché de l'utilisateur connecté (full_name → email → username). */
export function displayName(u: ApiUser | null | undefined): string {
  if (!u) return '';
  return (
    u.full_name?.trim() ||
    u.email?.trim() ||
    u.username?.trim() ||
    'Utilisateur'
  );
}

/** Initiales (2 lettres max) à partir d'un nom affiché. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Formate un montant en FCFA (séparateurs FR). */
export function fcfa(x: number): string {
  return `${Math.round(x).toLocaleString('fr-FR')} FCFA`;
}

/** Formate une plage horaire entière : 9,10 → "9h – 10h". */
export function heureRange(start: number, end: number): string {
  return `${start}h – ${end}h`;
}

/** Date du jour au format YYYY-MM-DD (fuseau local). */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Date longue FR : "Lundi 14 juillet 2026". */
export function dateLongueFR(d: Date = new Date()): string {
  const s = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Date courte FR : "14 juil.". */
export function dateCourteFR(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

/** Date FR "14 juillet 2026" à partir d'une chaîne ISO. */
export function dateFR(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
