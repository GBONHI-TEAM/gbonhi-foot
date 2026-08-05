'use client';
import { createSupabaseBrowserClient } from './supabase/client';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;

function withActivePeriod(path: string, init?: RequestInit): string {
  if (typeof window === 'undefined' || (init?.method ?? 'GET').toUpperCase() !== 'GET') return path;
  const pageParams = new URLSearchParams(window.location.search);
  const from = pageParams.get('from');
  const to = pageParams.get('to');
  if (!from && !to) return path;
  const [basePath, query = ''] = path.split('?');
  const requestParams = new URLSearchParams(query);
  if (from && !requestParams.has('from')) requestParams.set('from', from);
  if (to && !requestParams.has('to')) requestParams.set('to', to);
  return `${basePath}?${requestParams.toString()}`;
}

/**
 * Appel authentifié vers l'API backend GBONHI FOOT (portail partenaire).
 * Récupère le token JWT Supabase de la session courante et l'injecte
 * dans l'en-tête Authorization.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Récupère un access_token valide. Au premier rendu (juste après le login ou
 * un reload), la session Supabase peut ne pas être encore réhydratée depuis les
 * cookies : on réessaie brièvement pour éviter un 401 « token race ».
 */
async function getAccessToken(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  retries = 4,
): Promise<string | undefined> {
  for (let i = 0; i <= retries; i++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    if (i < retries) await sleep(150);
  }
  return undefined;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createSupabaseBrowserClient();

  const doFetch = async (token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${withActivePeriod(path, init)}`, { ...init, headers });
  };

  let token = await getAccessToken(supabase);
  let res = await doFetch(token);

  // Retry une fois sur 401 : la session vient peut-être d'être rafraîchie.
  if (res.status === 401) {
    await supabase.auth.getSession();
    token = await getAccessToken(supabase);
    if (token) res = await doFetch(token);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}${body ? ` — ${body}` : ''}`);
  }
  return res.json() as Promise<T>;
}

/** Télécharge une ressource binaire protégée (relevé PDF, export, etc.). */
export async function apiDownload(path: string, init?: RequestInit): Promise<Blob> {
  const supabase = createSupabaseBrowserClient();

  const doFetch = async (token?: string) => {
    const headers: Record<string, string> = {
      Accept: 'application/pdf, text/csv, application/octet-stream',
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${withActivePeriod(path, init)}`, { ...init, headers });
  };

  let token = await getAccessToken(supabase);
  let res = await doFetch(token);

  if (res.status === 401) {
    await supabase.auth.getSession();
    token = await getAccessToken(supabase);
    if (token) res = await doFetch(token);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}${body ? ` — ${body}` : ''}`);
  }

  return res.blob();
}
