export type TerrainSurface = 'artificial' | 'grass' | 'futsal';

export interface Terrain {
  id: string;
  name: string;
  address: string;
  city: string;
  surface: TerrainSurface;
  format: string;
  capacity: number;
  price_per_hour: number;
  photos: string[];
  amenities: string[];
  description: string;
  phone_contact: string | null;
  latitude: number | null;
  longitude: number | null;
  rating_avg: number;
  rating_count: number;
  _count?: { reservations: number; reviews: number };
}

export interface TerrainSlot {
  day_of_week: number; // 0 = lundi .. 6 = dimanche
  start_hour: number;
  end_hour: number;
}

export interface TerrainDetail extends Terrain {
  slots?: TerrainSlot[];
  blocks?: unknown[];
  partner?: unknown;
}

export interface TerrainAvailability {
  date: string;
  booked: number[];
  pending: number[];
  blocked: number[];
}

export interface TerrainReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user: { full_name: string | null; avatar_url: string | null };
}

export interface Reservation {
  id: string;
  terrain_id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  duration_hours: number;
  total_price: number;
  status: string;
  notes?: string | null;
}

export const SURFACE_LABELS: Record<TerrainSurface, string> = {
  artificial: 'Synthétique',
  grass: 'Gazon',
  futsal: 'Futsal',
};

export function formatFcfa(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}
