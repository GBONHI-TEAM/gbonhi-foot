import { Body, Controller, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateReservationCheckoutDto } from './dto/create-reservation-checkout.dto';
import { CreateLeagueCheckoutDto } from './dto/create-league-checkout.dto';
import { CheckoutMethodDto, TogglePaymentMethodDto } from './dto/checkout-method.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('reservations/checkout')
  checkoutReservation(@Body() dto: CreateReservationCheckoutDto, @CurrentUser() user: UserPayload) {
    return this.payments.checkoutReservation(dto, user);
  }

  // ── Suivi des tentatives de paiement (État de paiement admin) ──
  @UseGuards(SupabaseAuthGuard)
  @Post('intents')
  openIntent(@Body() dto: { mode?: string; amount?: number; payment_method?: string; context?: string }, @CurrentUser() user: UserPayload) {
    return this.payments.openIntent(user, dto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Patch('intents/:id')
  updateIntent(@Param('id') id: string, @Body() dto: { status?: string; amount?: number; payment_method?: string; reference?: string; context?: string }, @CurrentUser() user: UserPayload) {
    return this.payments.updateIntent(id, user, dto);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @Get('intents')
  listIntents(@Query('status') status?: string) {
    return this.payments.listIntents({ status });
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('reservations/:id/checkout')
  checkoutPendingReservation(
    @Param('id') id: string,
    @Body() dto: CheckoutMethodDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.payments.checkoutPendingReservation(id, dto, user);
  }

  /** Moyens de paiement ACTIVÉS (app mobile). */
  @UseGuards(SupabaseAuthGuard)
  @Get('methods')
  listMethods() {
    return this.payments.listEnabledMethods();
  }

  /** Tous les moyens + état (back-office). */
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('methods/all')
  listAllMethods() {
    return this.payments.listAllMethods();
  }

  /** Activer / désactiver un moyen de paiement (back-office). */
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('methods/:code')
  setMethod(@Param('code') code: string, @Body() dto: TogglePaymentMethodDto) {
    return this.payments.setMethodEnabled(code, dto.enabled);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('leagues/:id/checkout')
  checkoutLeague(@Param('id') id: string, @Body() dto: CreateLeagueCheckoutDto, @CurrentUser() user: UserPayload) {
    return this.payments.checkoutLeagueRegistration(id, dto, user);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('leagues/:leagueId/teams/:teamId/receipt.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="gbonhi-foot-recu-ligue.pdf"')
  async leagueReceipt(@Param('leagueId') leagueId: string, @Param('teamId') teamId: string, @CurrentUser() user: UserPayload) {
    return new StreamableFile(await this.payments.createLeagueRegistrationReceipt(leagueId, teamId, user));
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('reservations/:id')
  getReservationPayment(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.payments.getReservationPayment(id, user);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('reservations/:id/receipt.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="gbonhi-foot-recu.pdf"')
  async reservationReceipt(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return new StreamableFile(await this.payments.createReservationReceipt(id, user));
  }

  @Post('cinetpay/notify')
  notify(@Body() payload: Record<string, unknown>) {
    return this.payments.handleCinetPayNotification(payload);
  }

  @Get('cinetpay/return')
  paymentReturn() {
    return { ok: true, message: 'Paiement en cours de vérification.' };
  }
}
