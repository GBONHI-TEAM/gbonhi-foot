import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Client de l'API SMS d'Orange (Côte d'Ivoire).
 *
 * Authentification OAuth2 « client_credentials » (jeton mis en cache jusqu'à son
 * expiration), puis envoi via l'API SMS Messaging.
 *
 * Variables d'environnement attendues (à définir dans Render) :
 *  - ORANGE_SMS_AUTHORIZATION      : en-tête « Basic … » fourni par Orange (recommandé)
 *      OU ORANGE_SMS_CLIENT_ID + ORANGE_SMS_CLIENT_SECRET (on calcule le Basic)
 *  - ORANGE_SMS_SENDER_ADDRESS     : ex. « tel:+2250000 » (adresse expéditeur Orange)
 *  - ORANGE_SMS_SENDER_NAME        : (optionnel) nom court affiché comme expéditeur
 *  - ORANGE_SMS_TOKEN_URL          : (optionnel) défaut https://api.orange.com/oauth/v3/token
 *  - ORANGE_SMS_BASE_URL           : (optionnel) défaut https://api.orange.com/smsmessaging/v1/outbound
 */
@Injectable()
export class OrangeSmsService {
  private readonly logger = new Logger('OrangeSms');
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Le service est-il configuré (identifiants + expéditeur présents) ? */
  get configured(): boolean {
    return !!this.senderAddress && !!this.authorizationHeader;
  }

  private get tokenUrl(): string {
    return this.config.get<string>('ORANGE_SMS_TOKEN_URL') ?? 'https://api.orange.com/oauth/v3/token';
  }
  private get baseUrl(): string {
    return (this.config.get<string>('ORANGE_SMS_BASE_URL') ?? 'https://api.orange.com/smsmessaging/v1/outbound').replace(/\/+$/, '');
  }
  private get senderAddress(): string {
    return (this.config.get<string>('ORANGE_SMS_SENDER_ADDRESS') ?? '').trim();
  }
  private get senderName(): string {
    return (this.config.get<string>('ORANGE_SMS_SENDER_NAME') ?? '').trim();
  }
  private get authorizationHeader(): string {
    const direct = (this.config.get<string>('ORANGE_SMS_AUTHORIZATION') ?? '').trim();
    if (direct) return direct.toLowerCase().startsWith('basic ') ? direct : `Basic ${direct}`;
    const id = (this.config.get<string>('ORANGE_SMS_CLIENT_ID') ?? '').trim();
    const secret = (this.config.get<string>('ORANGE_SMS_CLIENT_SECRET') ?? '').trim();
    if (id && secret) return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
    return '';
  }

  /** Récupère (et met en cache) un jeton d'accès OAuth2. */
  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }
    if (!this.authorizationHeader) {
      throw new ServiceUnavailableException('SMS non configuré : identifiants Orange manquants.');
    }
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: this.authorizationHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Jeton Orange refusé (${res.status}): ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException('Authentification Orange SMS impossible (vérifie les identifiants).');
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new ServiceUnavailableException('Réponse Orange invalide (jeton absent).');
    }
    const ttlMs = (data.expires_in ?? 3600) * 1000;
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + ttlMs };
    return data.access_token;
  }

  /**
   * Envoie un SMS à un numéro au format E.164 (ex. « +2250700000000 »).
   * Lève une ServiceUnavailableException en cas d'échec (non configuré, auth, API).
   */
  async sendSms(toE164: string, message: string): Promise<void> {
    if (!this.configured) {
      throw new ServiceUnavailableException('SMS non configuré.');
    }
    const token = await this.getToken();
    const sender = this.senderAddress;
    const url = `${this.baseUrl}/${encodeURIComponent(sender)}/requests`;
    const payload = {
      outboundSMSMessageRequest: {
        address: `tel:${toE164}`,
        senderAddress: sender,
        ...(this.senderName ? { senderName: this.senderName } : {}),
        outboundSMSTextMessage: { message },
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Envoi SMS Orange échoué (${res.status}): ${text.slice(0, 300)}`);
      // Jeton invalide → on force un renouvellement au prochain appel.
      if (res.status === 401) this.cachedToken = null;
      throw new ServiceUnavailableException('L’envoi du SMS a échoué. Réessaie dans un instant.');
    }
  }
}
