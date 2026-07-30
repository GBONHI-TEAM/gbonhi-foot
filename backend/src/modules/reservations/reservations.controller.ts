import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ChangeReservationStatusDto } from './dto/change-status.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';

@UseGuards(SupabaseAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  findForPartner(
    @CurrentUser() user: UserPayload,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('terrain_id') terrainId?: string,
  ) {
    return this.reservationsService.findForPartner(user, {
      date,
      status,
      terrain_id: terrainId,
    });
  }

  @Get('stats/summary')
  summary(@CurrentUser() user: UserPayload) {
    return this.reservationsService.summary(user);
  }

  @Get('all')
  findAllAdmin(
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    return this.reservationsService.findAllAdmin({ date, status });
  }

  @Get('mine')
  findMine(@CurrentUser() user: UserPayload) {
    return this.reservationsService.findMine(user);
  }

  @Get(':id')
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
