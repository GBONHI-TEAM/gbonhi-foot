import { create } from 'zustand';

export interface PendingReservationCart {
  id: string;
  terrain_id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  duration_hours: number;
  total_price: number;
  created_at: string;
  terrain?: {
    id: string;
    name: string;
    city?: string | null;
    address?: string | null;
    photos?: string[] | null;
  } | null;
}

interface ReservationCartState {
  pendingReservation: PendingReservationCart | null;
  setPendingReservation: (reservation: PendingReservationCart | null) => void;
  clearPendingReservation: () => void;
}

/**
 * État éphémère du menu Panier. Le backend reste la source de vérité : au
 * prochain lancement, le layout recharge la réservation pending de l'user.
 */
export const useReservationCartStore = create<ReservationCartState>((set) => ({
  pendingReservation: null,
  setPendingReservation: (pendingReservation) => set({ pendingReservation }),
  clearPendingReservation: () => set({ pendingReservation: null }),
}));
