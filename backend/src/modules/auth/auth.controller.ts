import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsEmail, MinLength, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { PhoneOtpService } from './phone-otp.service';
import { OrangeSmsService } from '../sms/orange-sms.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

class RequestOtpDto {
  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['register', 'login', 'verify-phone'])
  purpose?: string;
}

class VerifyOtpDto {
  @IsString()
  @MaxLength(20)
  phone: string;

  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code: string;

  @IsOptional()
  @IsIn(['register', 'login', 'verify-phone'])
  purpose?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}

class SmsTestDto {
  @IsString()
  @MaxLength(20)
  to: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

/**
 * Endpoints PUBLICS (aucun guard) utilisés AVANT authentification :
 *  - /auth/check-account : détecte un compte existant (email OU téléphone).
 *  - /auth/resolve-login : retrouve l'email associé à un numéro.
 *  - /auth/phone/request-otp & /auth/phone/verify-otp : vérification par SMS (Orange).
 *  - /auth/sms/test : envoi d'un SMS de test (réservé au staff) pour valider la config.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneOtp: PhoneOtpService,
    private readonly orangeSms: OrangeSmsService,
  ) {}

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

  // ── Vérification par SMS (Orange) ───────────────────────────────────────────

  @Post('phone/request-otp')
  @ApiOperation({ summary: 'Envoie un code de vérification par SMS (Orange)' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.phoneOtp.requestOtp({ phone: dto.phone, email: dto.email, purpose: dto.purpose });
  }

  @Post('phone/verify-otp')
  @ApiOperation({ summary: 'Vérifie le code SMS ; ouvre une session pour inscription/connexion' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.phoneOtp.verifyOtp({
      phone: dto.phone,
      code: dto.code,
      purpose: dto.purpose,
      email: dto.email,
      fullName: dto.fullName,
    });
  }

  // ── Diagnostic de la config SMS (staff) : quelles variables sont présentes ──
  @Get('sms/status')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'État de la configuration Orange SMS (booléens, sans secrets)' })
  smsStatus() {
    return this.orangeSms.diagnostics();
  }

  // ── Test d'envoi SMS (staff uniquement) : valide la config Orange ───────────
  @Post('sms/test')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Envoie un SMS de test (validation de la config Orange)' })
  async smsTest(@Body() dto: SmsTestDto): Promise<{ sent: boolean; configured: boolean }> {
    await this.orangeSms.sendSms(dto.to.trim(), dto.message?.trim() || 'GBONHI FOOT : SMS de test. Configuration Orange OK.');
    return { sent: true, configured: this.orangeSms.configured };
  }
}
