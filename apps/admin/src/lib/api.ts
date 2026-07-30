'use client';
import { createSupabaseBrowserClient } from './supabase/client';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;

/**
 * Appel authentifié vers l'API backend GBONHI FOOT.
 * Récupère le token JWT Supabase de la session courante et l'injecte
 * dans l'en-tête Authorization.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}${body ? ` — ${body}` : ''}`);
  }
  return res.json() as Promise<T>;
}
