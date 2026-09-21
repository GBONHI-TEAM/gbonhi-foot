import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  // Sortie VOLONTAIRE en cours (déconnexion / suppression de compte / retour à
  // l'inscription). Tant que c'est vrai, l'AuthGate ne force plus « vérifie ton
  // numéro » ni l'écran OTP : il purge les parcours en cours et ramène l'utilisateur
  // vers `authResetTarget` dès que la session est réellement nulle. Évite de rester
  // coincé sur la vérification du numéro après suppression du compte.
  authResetting: boolean;
  authResetTarget: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  beginAuthReset: (target?: string) => void;
  endAuthReset: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  authResetting: false,
  authResetTarget: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  beginAuthReset: (target = '/(auth)/login') => set({ authResetting: true, authResetTarget: target }),
  endAuthReset: () => set({ authResetting: false, authResetTarget: null }),
  reset: () => set({ user: null, session: null, isLoading: false, authResetting: false, authResetTarget: null }),
}));
