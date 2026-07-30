import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Endpoints PUBLICS (aucun guard) utilisés AVANT authentification :
 *  - /auth/check-account : détecte un compte existant (email OU téléphone) pour
 *    empêcher les inscriptions en doublon.
 *  - /auth/resolve-login : retrouve l'email associé à un numéro pour permettre la
 *    connexion par téléphone via le canal OTP e-mail (tant que le SMS n'est pas
 *    configuré). Les comptes sont créés via e-mail : `auth.users.email` porte
 *    l'identité, le numéro est stocké dans `raw_user_meta_data->>'phone'`.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('check-account')
  @ApiOperation({ summary: 'Vérifie si un compte existe (email ou téléphone)' })
  async checkAccount(
    @Body() body: { email?: string; phone?: string },
  ): Promise<{ emailExists: boolean; phoneExists: boolean }> {
    const email = (body.email ?? '').trim().toLowerCase();
    const phone = (body.phone ?? '').trim();

    const rows = await this.prisma.$queryRaw<
      { email: string | null; phone: string | null }[]
    >`
      SELECT email, raw_user_meta_data->>'phone' AS phone
      FROM auth.users
      WHERE (${email} <> '' AND lower(email) = ${email})
         OR (${phone} <> '' AND raw_user_meta_data->>'phone' = ${phone})
    `;

    return {
      emailExists: !!email && rows.some((r) => (r.email ?? '').toLowerCase() === email),
      phoneExists: !!phone && rows.some((r) => (r.phone ?? '') === phone),
    };
  }

  @Post('resolve-login')
  @ApiOperation({ summary: 'Retrouve l\'email associé à un numéro de téléphone' })
  async resolveLogin(
    @Body() body: { phone?: string },
  ): Promise<{ email: string | null }> {
    const phone = (body.phone ?? '').trim();
    if (!phone) return { email: null };

    const rows = await this.prisma.$queryRaw<{ email: string | null }[]>`
      SELECT email
      FROM auth.users
      WHERE raw_user_meta_data->>'phone' = ${phone}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return { email: rows[0]?.email ?? null };
  }
}
