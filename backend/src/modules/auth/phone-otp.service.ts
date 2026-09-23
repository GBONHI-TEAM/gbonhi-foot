import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from './supabase.service';
import { OrangeSmsService } from '../sms/orange-sms.service';

type Purpose = 'register' | 'login' | 'verify-phone';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 s entre deux demandes
const MAX_ATTEMPTS = 5;

/**
 * Vérification par SMS « maison » (Orange). On génère un code à 6 chiffres,
 * stocké UNIQUEMENT sous forme hachée (HMAC-SHA256) avec expiration, envoyé par
 * SMS. La vérification, en cas de succès pour une inscription/connexion, crée une
 * SESSION Supabase (l'e-mail reste l'identité du compte) sans envoyer d'e-mail :
 * on utilise generateLink et on renvoie le jeton au client, qui appelle verifyOtp.
 */
@Injectable()
export class PhoneOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly orangeSms: OrangeSmsService,
  ) {}

  private normalizePhone(raw: string): string {
    const trimmed = (raw ?? '').replace(/\s+/g, '');
    if (!trimmed) return '';
    if (trimmed.startsWith('+')) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    return `+225${digits}`; // fallback : numéro ivoirien local
  }

  private hash(phone: string, code: string): string {
    const secret =
      this.config.get<string>('OTP_HASH_SECRET') ??
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      'gbonhi-otp-secret';
    return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
  }

  /** Génère un code, l'enregistre haché, et l'envoie par SMS. */
  async requestOtp(input: { phone: string; email?: string; purpose?: string }): Promise<{ sent: true; expiresInSeconds: number }> {
    const phone = this.normalizePhone(input.phone);
    if (!/^\+\d{8,15}$/.test(phone)) {
      throw new BadRequestException('Numéro de téléphone invalide.');
    }
    if (!this.orangeSms.configured) {
      throw new ServiceUnavailableException('La vérification par SMS n’est pas encore configurée.');
    }
    const purpose: Purpose = (['register', 'login', 'verify-phone'] as const).includes(input.purpose as Purpose)
      ? (input.purpose as Purpose)
      : 'register';

    // Anti-spam : au moins 30 s entre deux demandes pour un même numéro.
    const recent = await this.prisma.phoneOtp.findFirst({
      where: { phone },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });
    if (recent && Date.now() - recent.created_at.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException('Patiente quelques secondes avant de redemander un code.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.phoneOtp.create({
      data: {
        phone,
        email: input.email?.trim().toLowerCase() || null,
        purpose,
        code_hash: this.hash(phone, code),
        expires_at: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await this.orangeSms.sendSms(
      phone,
      `GBONHI FOOT : ton code de verification est ${code}. Il expire dans 5 minutes. Ne le partage avec personne.`,
    );

    return { sent: true, expiresInSeconds: Math.round(OTP_TTL_MS / 1000) };
  }

  /**
   * Vérifie le code. Succès :
   *  - purpose « verify-phone » → { verified:true } (l'appelant est déjà connecté).
   *  - purpose « register » / « login » → crée une session Supabase et renvoie de
   *    quoi l'établir côté client (email + token).
   */
  async verifyOtp(input: {
    phone: string;
    code: string;
    purpose?: string;
    email?: string;
    fullName?: string;
  }): Promise<{ verified: true; email?: string | null; otp?: string; tokenHash?: string }> {
    const phone = this.normalizePhone(input.phone);
    const purpose: Purpose = (['register', 'login', 'verify-phone'] as const).includes(input.purpose as Purpose)
      ? (input.purpose as Purpose)
      : 'register';

    const row = await this.prisma.phoneOtp.findFirst({
      where: { phone, purpose, consumed_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    if (!row) {
      throw new BadRequestException('Code expiré ou introuvable. Redemande un nouveau code.');
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Trop de tentatives. Redemande un nouveau code.');
    }

    const ok = this.hash(phone, String(input.code ?? '').trim()) === row.code_hash;
    await this.prisma.phoneOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 }, ...(ok ? { consumed_at: new Date() } : {}) },
    });
    if (!ok) {
      throw new BadRequestException('Code incorrect.');
    }

    if (purpose === 'verify-phone') {
      return { verified: true };
    }

    // Inscription / connexion : l'e-mail reste l'identité du compte.
    const email = (input.email ?? row.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('E-mail requis pour établir la session.');
    }
    const session = await this.issueSession(email, {
      phone,
      ...(input.fullName?.trim() ? { full_name: input.fullName.trim() } : {}),
    }, purpose === 'register');
    return { verified: true, email, otp: session.otp, tokenHash: session.tokenHash };
  }

  /** Crée l'utilisateur si besoin (inscription) et génère un jeton de session. */
  private async issueSession(
    email: string,
    metadata: Record<string, unknown>,
    allowCreate: boolean,
  ): Promise<{ otp: string; tokenHash: string }> {
    const existingId = await this.findAuthUserIdByEmail(email);
    if (!existingId) {
      if (!allowCreate) {
        throw new BadRequestException('Aucun compte associé. Inscris-toi d’abord.');
      }
      const { error } = await this.supabase.client.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) {
        throw new ServiceUnavailableException('Création du compte impossible. Réessaie dans un instant.');
      }
    } else {
      // Compte existant (connexion) : on met à jour le numéro/nom si fournis.
      try {
        await this.supabase.client.auth.admin.updateUserById(existingId, { user_metadata: metadata });
      } catch {
        /* best-effort */
      }
    }

    const { data, error } = await this.supabase.client.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const props = data?.properties as { email_otp?: string; hashed_token?: string } | undefined;
    if (error || !props?.email_otp || !props?.hashed_token) {
      throw new ServiceUnavailableException('Ouverture de session impossible. Réessaie dans un instant.');
    }
    return { otp: props.email_otp, tokenHash: props.hashed_token };
  }

  private async findAuthUserIdByEmail(email: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM auth.users WHERE lower(email) = ${email} LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }
}
