'use client';
import { createSupabaseBrowserClient } from './supabase/client';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: string[],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: string[];
  requestId?: string;
};

/** Propage la période active de l'écran aux requêtes GET du back-office. */
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
 * Appel authentifié vers l'API backend GBONHI FOOT.
 * Récupère le token JWT Supabase de la session courante et l'injecte
 * dans l'en-tête Authorization.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // On ne déclare `application/json` QUE si la requête a réellement un corps.
  // Sinon Fastify rejette (« Body cannot be empty when content-type is set to
  // 'application/json' ») les POST/DELETE sans body (ex. génération de calendrier).
  const headers: Record<string, string> = {
    ...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    throw new ApiError('Votre session a expiré. Connectez-vous à nouveau.', 401, 'AUTHENTICATION_REQUIRED');
  }

  const res = await fetch(`${API_BASE}${withActivePeriod(path, init)}`, { ...init, headers });
  if (!res.ok) {
    const payload = await res.json().catch((): ApiErrorPayload => ({}));
    throw new ApiError(
      payload.message ?? 'Une erreur est survenue. Réessaie dans quelques instants.',
      res.status,
      payload.code ?? 'REQUEST_FAILED',
      payload.details,
      payload.requestId,
    );
  }
  return res.json() as Promise<T>;
}
