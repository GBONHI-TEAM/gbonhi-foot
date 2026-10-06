import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Client du prestataire de paiement Wave (Checkout API).
 * Docs : https://docs.wave.com/checkout
 *
 * Tout est désactivé tant que WAVE_API_KEY n'est pas défini : `configured`
 * renvoie false et aucune requête réseau n'est tentée. On pourra ainsi
 * déployer l'architecture AVANT d'avoir réellement les clés Wave.
 */
export interface WaveCheckoutSession {
  id: string;
  amount: string;
  currency: string;
  checkout_status: 'open' | 'complete' | 'expired';
  payment_status: 'processing' | 'cancelled' | 'succeeded' | null;
  client_reference: string | null;
  transaction_id: string | null;
  wave_launch_url: string;
  success_url: string;
  error_url: string;
  last_payment_error?: { code: string; message: string } | null;
  when_completed?: string | null;
  when_created?: string;
  when_expires?: string;
}

const SIGNATURE_MAX_AGE_SEC = 5 * 60; // 5 minutes (cf. doc Wave)

@Injectable()
export class WaveService {
  private readonly logger = new Logger('WaveService');

  constructor(private readonly config: ConfigService) {}

  // ── Configuration (aucun secret n'est jamais renvoyé) ───────────────────────
  private get apiKey(): string {
    return (this.config.get<string>('WAVE_API_KEY') ?? '').trim();
  }
  private get apiBase(): string {
    return (this.config.get<string>('WAVE_API_BASE') ?? 'https://api.wave.com').replace(/\/+$/, '');
  }
  private get signingSecret(): string {
    // Optionnel : signature des requêtes sortantes (si activée sur la clé API).
    return (this.config.get<string>('WAVE_SIGNING_SECRET') ?? '').trim();
  }
  private get webhookSecret(): string {
    return (this.config.get<string>('WAVE_WEBHOOK_SECRET') ?? '').trim();
  }
  private get aggregatedMerchantId(): string {
    return (this.config.get<string>('WAVE_AGGREGATED_MERCHANT_ID') ?? '').trim();
  }
  get successUrl(): string {
    return (this.config.get<string>('WAVE_SUCCESS_URL') ?? '').trim();
  }
  get errorUrl(): string {
    return (this.config.get<string>('WAVE_ERROR_URL') ?? '').trim();
  }

  /** Vrai si une clé API Wave est configurée. */
  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  /** État de la config (booléens, pour un endpoint de diagnostic admin). */
  diagnostics() {
    return {
      configured: this.configured,
      apiBase: this.apiBase,
      hasSigningSecret: this.signingSecret.length > 0,
      hasWebhookSecret: this.webhookSecret.length > 0,
      hasAggregatedMerchant: this.aggregatedMerchantId.length > 0,
      successUrlSet: this.successUrl.length > 0,
      errorUrlSet: this.errorUrl.length > 0,
    };
  }

  // ── Création d'une session de checkout ──────────────────────────────────────
  /**
   * Crée une session de paiement Wave et renvoie l'objet (dont `wave_launch_url`).
   * `amount` est en FCFA entier (XOF n'autorise aucune décimale).
   */
  async createCheckoutSession(input: {
    amount: number;
    clientReference: string;
    successUrl: string;
    errorUrl: string;
    restrictPayerMobile?: string;
  }): Promise<WaveCheckoutSession> {
    if (!this.configured) {
      throw new ServiceUnavailableException('Le paiement Wave n’est pas encore configuré.');
    }
    const body: Record<string, unknown> = {
      amount: String(Math.round(input.amount)),
      currency: 'XOF',
      client_reference: input.clientReference,
      success_url: input.successUrl,
      error_url: input.errorUrl,
    };
    if (input.restrictPayerMobile) body.restrict_payer_mobile = input.restrictPayerMobile;
    if (this.aggregatedMerchantId) body.aggregated_merchant_id = this.aggregatedMerchantId;

    return this.request<WaveCheckoutSession>('POST', '/v1/checkout/sessions', body);
  }

  /** Récupère une session par son id (cos-...). */
  async getCheckoutSession(id: string): Promise<WaveCheckoutSession> {
    return this.request<WaveCheckoutSession>('GET', `/v1/checkout/sessions/${encodeURIComponent(id)}`);
  }

  /**
   * Rembourse le paiement d'une session de checkout. Idempotent côté Wave
   * (rembourser deux fois ne crée pas de seconde transaction).
   */
  async refundCheckout(id: string): Promise<void> {
    await this.request<unknown>('POST', `/v1/checkout/sessions/${encodeURIComponent(id)}/refund`);
  }

  // ── Vérification de la signature du webhook ─────────────────────────────────
  /**
   * Vérifie l'en-tête `Wave-Signature: t=<ts>,v1=<sig>[,v1=<sig2>]` sur le CORPS
   * BRUT reçu. Signature = HMAC-SHA256( `${timestamp}${rawBody}` ) en hex, avec
   * le secret de webhook. Plusieurs `v1` peuvent être fournis (rotation de clé).
   * Refuse si l'horodatage a plus de 5 minutes.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    const secret = this.webhookSecret;
    if (!secret || !signatureHeader) return false;

    const parts = signatureHeader.split(',').map((p) => p.trim());
    const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
    const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    const ageSec = Math.abs(Date.now() / 1000 - ts);
    if (ageSec > SIGNATURE_MAX_AGE_SEC) {
      this.logger.warn('Signature Wave rejetée : horodatage hors délai.');
      return false;
    }

    const expected = createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    return signatures.some((sig) => {
      try {
        const sigBuf = Buffer.from(sig, 'hex');
        return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
      } catch {
        return false;
      }
    });
  }

  // ── Appel HTTP interne ──────────────────────────────────────────────────────
  private async request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.apiBase}${path}`;
    const rawBody = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (body) headers['Content-Type'] = 'application/json';
    // Signature des requêtes sortantes si la clé l'exige (optionnel).
    if (this.signingSecret) {
      const t = Math.floor(Date.now() / 1000);
      const sig = createHmac('sha256', this.signingSecret).update(`${t}${rawBody}`).digest('hex');
      headers['Wave-Signature'] = `t=${t},v1=${sig}`;
    }

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: body ? rawBody : undefined });
    } catch (e) {
      this.logger.error(`Appel Wave échoué (${method} ${path}) : ${e instanceof Error ? e.message : e}`);
      throw new ServiceUnavailableException('Service de paiement Wave indisponible. Réessaie dans un instant.');
    }

    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const code = (data as { code?: string } | null)?.code ?? `http-${res.status}`;
      this.logger.error(`Erreur Wave (${method} ${path}) : ${res.status} ${code}`);
      throw new ServiceUnavailableException(`Paiement Wave refusé (${code}).`);
    }
    return data as T;
  }
}
