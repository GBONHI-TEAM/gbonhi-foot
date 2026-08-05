import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('leagues/:leagueId/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('generate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  generateCalendar(@Param('leagueId') leagueId: string) {
    return this.calendarService.generateCalendar(leagueId);
  }

  @Post('publish')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  publishCalendar(
    @Param('leagueId') leagueId: string,
    @Query('round') round?: string,
  ) {
    return this.calendarService.publishCalendar(leagueId, round ? parseInt(round) : undefined);
  }

  @Post('unpublish')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  unpublishCalendar(
    @Param('leagueId') leagueId: string,
    @Query('round') round?: string,
  ) {
    return this.calendarService.unpublishCalendar(leagueId, round ? parseInt(round) : undefined);
  }

  @Get()
  getCalendar(
    @Param('leagueId') leagueId: string,
    @Query('round') round?: string,
  ) {
    return this.calendarService.getCalendar(leagueId, round ? parseInt(round) : undefined);
  }
}
