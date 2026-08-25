import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ChangeReservationStatusDto } from './dto/change-status.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  findForPartner(
    @CurrentUser() user: UserPayload,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('terrain_id') terrainId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reservationsService.findForPartner(user, {
      date,
      status,
      terrain_id: terrainId,
      from,
      to,
    });
  }

  @Get('stats/summary')
  summary(@CurrentUser() user: UserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reservationsService.summary(user, from, to);
  }

  @Get('stats/operational-summary')
  operationalSummary(@CurrentUser() user: UserPayload) {
    return this.reservationsService.operationalSummary(user);
  }

  @Get('stats/revenue-history')
  revenueHistory(@CurrentUser() user: UserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reservationsService.revenueHistory(user, from, to);
  }

  @Get('stats/revenue-statement.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="gbonhi-foot-releve-partenaire.pdf"')
  async revenueStatement(@CurrentUser() user: UserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return new StreamableFile(await this.reservationsService.revenueStatement(user, from, to));
  }

  @Get('all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  findAllAdmin(
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reservationsService.findAllAdmin({ date, status, from, to });
  }

  @Get('mine')
  findMine(@CurrentUser() user: UserPayload) {
    return this.reservationsService.findMine(user);
  }

  @Get('mine/pending')
  findPendingMine(@CurrentUser() user: UserPayload) {
    return this.reservationsService.findPendingMine(user);
  }

  /** Panier multi : liste des réservations en attente de l'utilisateur. */
  @Get('mine/cart')
  findCartMine(@CurrentUser() user: UserPayload) {
    return this.reservationsService.findCartMine(user);
  }

  @Patch('mine/:id/cancel')
  cancelMinePending(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.reservationsService.cancelMinePending(id, user);
  }

  @Get('mine/:id')
  findMineOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.reservationsService.findMineOne(id, user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: UserPayload) {
    return this.reservationsService.create(dto, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: ChangeReservationStatusDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.reservationsService.updateStatus(id, dto, user);
  }
}
