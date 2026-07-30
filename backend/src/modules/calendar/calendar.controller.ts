import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@UseGuards(SupabaseAuthGuard)
@Controller('leagues/:leagueId/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('generate')
  generateCalendar(@Param('leagueId') leagueId: string) {
    return this.calendarService.generateCalendar(leagueId);
  }

  @Post('publish')
  publishCalendar(
    @Param('leagueId') leagueId: string,
    @Query('round') round?: string,
  ) {
    return this.calendarService.publishCalendar(leagueId, round ? parseInt(round) : undefined);
  }

  @Post('unpublish')
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
