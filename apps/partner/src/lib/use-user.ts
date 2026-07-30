'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { ApiUser } from './domain';

/**
 * Récupère le profil de l'utilisateur connecté via `GET /users/me`.
 * Aucune donnée mockée : renvoie `null` tant que la requête n'a pas abouti.
 */
export function useCurrentUser(): ApiUser | null {
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ApiUser>('/users/me')
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        /* état vide — pas de fallback fictif */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
