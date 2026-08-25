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
  /** Réservations en attente (panier multi). */
  pendingReservations: PendingReservationCart[];
  setPendingReservations: (reservations: PendingReservationCart[] | null) => void;
  /** Retire une réservation du panier (après validation ou annulation). */
  removePendingReservation: (id: string) => void;
  clearPendingReservations: () => void;
}

/**
 * État éphémère du menu Panier. Le backend reste la source de vérité : au
 * prochain lancement, le layout recharge les réservations pending de l'user.
 */
export const useReservationCartStore = create<ReservationCartState>((set) => ({
  pendingReservations: [],
  setPendingReservations: (reservations) => set({ pendingReservations: reservations ?? [] }),
  removePendingReservation: (id) =>
    set((state) => ({ pendingReservations: state.pendingReservations.filter((r) => r.id !== id) })),
  clearPendingReservations: () => set({ pendingReservations: [] }),
}));
