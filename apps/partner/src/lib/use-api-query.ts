'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from './api';

/**
 * Hook de lecture mis en cache pour le portail partenaire. Remplace le trio
 * useEffect + useState(data) + useState(loading) : les données sont mises en
 * cache par `key`, affichées instantanément au retour sur une page, et
 * revalidées en arrière-plan.
 *
 * La période active de l'URL (?from=&to=) est ajoutée automatiquement à la clé.
 * Pour les écrans « par terrain », pense à inclure l'id du terrain sélectionné
 * dans `key` pour que changer de terrain recharge les bonnes données.
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  options?: Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>,
) {
  const params = useSearchParams();
  const period = `${params.get('from') ?? ''}-${params.get('to') ?? ''}`;
  return useQuery<T, Error, T, readonly unknown[]>({
    queryKey: [...key, period],
    queryFn: () => apiFetch<T>(path),
    ...options,
  });
}
