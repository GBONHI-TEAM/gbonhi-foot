import { Body, Controller, Get, Header, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateReservationCheckoutDto } from './dto/create-reservation-checkout.dto';
import { CreateLeagueCheckoutDto } from './dto/create-league-checkout.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('reservations/checkout')
  checkoutReservation(@Body() dto: CreateReservationCheckoutDto, @CurrentUser() user: UserPayload) {
    return this.payments.checkoutReservation(dto, user);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('reservations/:id/checkout')
  checkoutPendingReservation(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.payments.checkoutPendingReservation(id, user);
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
