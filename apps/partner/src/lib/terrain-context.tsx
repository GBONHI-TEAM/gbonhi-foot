'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from './api';
import type { ApiTerrain } from './domain';

/**
 * Contexte terrain partagé du portail partenaire.
 * Un propriétaire peut détenir PLUSIEURS terrains : on charge la liste une
 * seule fois (`/terrains/mine`), on mémorise le terrain sélectionné (persisté
 * en localStorage) et toutes les pages « par terrain » se calent dessus via
 * `useTerrain()`. Le sélecteur du header pilote `setSelectedId`.
 */

interface TerrainContextValue {
  terrains: ApiTerrain[];
  selectedTerrain: ApiTerrain | null;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
}

const TerrainContext = createContext<TerrainContextValue | null>(null);
const STORAGE_KEY = 'partnerSelectedTerrainId';

export function TerrainProvider({ children }: { children: ReactNode }) {
  const [terrains, setTerrains] = useState<ApiTerrain[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<ApiTerrain[]>('/terrains/mine');
      const list = Array.isArray(data) ? data : [];
      setTerrains(list);
      setSelectedIdState((current) => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        const isValid = (id: string | null) => !!id && list.some((t) => t.id === id);
        if (isValid(current)) return current;
        if (isValid(stored)) return stored;
        return list[0]?.id ?? null;
      });
    } catch {
      setTerrains([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedTerrain = terrains.find((t) => t.id === selectedId) ?? null;

  return (
    <TerrainContext.Provider
      value={{ terrains, selectedTerrain, selectedId, setSelectedId, loading, reload: load }}
    >
      {children}
    </TerrainContext.Provider>
  );
}

export function useTerrain(): TerrainContextValue {
  const ctx = useContext(TerrainContext);
  if (!ctx) throw new Error('useTerrain doit être utilisé dans un TerrainProvider');
  return ctx;
}
