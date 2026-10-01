'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Fournit le cache React Query à tout le back-office. Les données déjà chargées
 * restent en mémoire : au retour sur un onglet, elles s'affichent
 * INSTANTANÉMENT (depuis le cache) et ne sont rafraîchies en arrière-plan que si
 * elles sont « périmées » (staleTime). Fini l'écran de chargement à chaque
 * changement d'onglet.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 min « frais » → pas de refetch au retour immédiat
            gcTime: 10 * 60_000, // 10 min conservé en cache mémoire
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
