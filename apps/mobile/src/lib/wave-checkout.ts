import * as WebBrowser from 'expo-web-browser';
import { apiClient } from './api';

/**
 * Parcours de paiement Wave côté mobile.
 *
 * Wave fonctionne en checkout hébergé : le backend crée une session et renvoie
 * `checkout_url` (wave_launch_url). On l'ouvre dans le NAVIGATEUR système (via
 * expo-web-browser), jamais en webview — sinon le rebond vers l'app Wave échoue.
 * Après retour, on sonde l'état de l'intent jusqu'à confirmation (webhook).
 *
 * Tant que Wave n'est pas configuré côté serveur (pas de clé API), le backend
 * répond 503 : `start*` renvoie alors `null` pour permettre un repli vers le
 * paiement simulé existant.
 */
export type WaveStart = { checkout_url: string; intent_id: string };
export type WaveFinalStatus = 'validated' | 'cancelled' | 'pending';

function isNotConfigured(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 503;
}

async function startCheckout(path: string, body?: Record<string, unknown>): Promise<WaveStart | null> {
  try {
    const { data } = await apiClient.post<WaveStart>(path, body ?? {});
    // Ouvre le lien Wave dans le navigateur système (SFSafariViewController /
    // Chrome Custom Tab) — compatible avec le rebond vers l'app Wave.
    await WebBrowser.openBrowserAsync(data.checkout_url);
    return data;
  } catch (error) {
    if (isNotConfigured(error)) return null; // Wave pas encore activé → repli
    throw error;
  }
}

/** Démarre un checkout Wave pour une réservation. Ouvre le navigateur. */
export function startWaveReservation(reservationId: string): Promise<WaveStart | null> {
  return startCheckout(`/api/v1/payments/wave/reservations/${reservationId}/checkout`);
}

/** Démarre un checkout Wave pour une inscription en ligue. Ouvre le navigateur. */
export function startWaveLeague(leagueId: string, teamId: string): Promise<WaveStart | null> {
  return startCheckout(`/api/v1/payments/wave/leagues/${leagueId}/checkout`, { team_id: teamId });
}

/**
 * Sonde l'état de l'intent après retour du navigateur. Renvoie le statut final
 * ('validated' = payé & finalisé, 'cancelled' = échec/remboursé) ou 'pending'
 * si rien n'est confirmé dans le délai imparti.
 */
export async function waitForIntent(
  intentId: string,
  { attempts = 20, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<WaveFinalStatus> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const { data } = await apiClient.get<{ status: string }>(`/api/v1/payments/wave/intents/${intentId}`);
      if (data.status === 'validated' || data.status === 'cancelled') {
        return data.status;
      }
    } catch {
      /* on réessaie */
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return 'pending';
}
