import { apiClient } from './api';

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Lit une ressource API avec deux garde-fous pour l'interface mobile :
 * - les données récentes sont immédiatement réutilisées quand on revient sur
 *   un onglet ;
 * - deux composants demandant la même URL partagent une seule requête réseau.
 *
 * Le cache reste strictement en mémoire : un redémarrage de l'app ou un délai
 * court force naturellement une lecture fraîche depuis l'API.
 */
export async function getCached<T>(path: string, ttlMs = 30_000, force = false): Promise<T> {
  const now = Date.now();
  const cached = responseCache.get(path);
  if (!force && cached && cached.expiresAt > now) return cached.data as T;

  const current = inFlightRequests.get(path);
  if (current) return current as Promise<T>;

  const request = apiClient.get<T>(path)
    .then(({ data }) => {
      responseCache.set(path, { data, expiresAt: Date.now() + ttlMs });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(path);
    });

  inFlightRequests.set(path, request);
  return request;
}

/** Invalide une ressource après une écriture qui peut la modifier. */
export function invalidateCached(pathPrefix: string): void {
  for (const key of responseCache.keys()) {
    if (key.startsWith(pathPrefix)) responseCache.delete(key);
  }
}
