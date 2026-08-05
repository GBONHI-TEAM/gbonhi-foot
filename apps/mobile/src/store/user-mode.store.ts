import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

type UserMode = 'leagues' | 'reservation';

const STORAGE_KEY = 'gbonhi_user_mode';

interface UserModeState {
  mode: UserMode | null;
  /** true une fois que l'état de mode est prêt pour le routeur */
  hydrated: boolean;
  setMode: (mode: UserMode) => void;
  loadMode: () => Promise<void>;
  /**
   * Chaque nouveau lancement repart du choix de mode demandé par le produit.
   * Le mode reste disponible pendant la session courante, mais il n'est jamais
   * restauré après fermeture complète de l'application.
   */
  startNewAppSession: () => Promise<void>;
  clearMode: () => Promise<void>;
}

export const useUserModeStore = create<UserModeState>((set) => ({
  mode: null,
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    SecureStore.setItemAsync(STORAGE_KEY, mode).catch(() => {});
  },
  loadMode: async () => {
    try {
      const saved = (await SecureStore.getItemAsync(STORAGE_KEY)) as UserMode | null;
      set({ mode: saved ?? null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  startNewAppSession: async () => {
    set({ mode: null, hydrated: true });
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
  },
  clearMode: async () => {
    set({ mode: null });
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
  },
}));
