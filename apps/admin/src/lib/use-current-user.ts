'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface CurrentUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  city: string | null;
  email?: string | null;
}

/** Calcule les initiales (2 lettres) à partir du nom affiché. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Récupère le profil de l'utilisateur connecté via `GET /users/me`.
 * Retourne le nom d'affichage (full_name, fallback email) et ses initiales.
 * Aucune donnée codée en dur : tant que le profil n'est pas chargé, `displayName`
 * et `initials` restent nuls.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<CurrentUser>('/users/me');
        if (!cancelled) setUser(data);
      } catch {
        /* profil indisponible : on n'affiche aucune donnée fictive */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = user ? user.full_name?.trim() || user.email?.trim() || user.username?.trim() || null : null;
  const initials = displayName ? initialsFrom(displayName) : null;

  return { user, displayName, initials };
}
