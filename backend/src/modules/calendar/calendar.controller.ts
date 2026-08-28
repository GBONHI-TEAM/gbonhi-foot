import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { BracketService } from './bracket.service';
import { PoolsService } from './pools.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('leagues/:leagueId/calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly bracketService: BracketService,
    private readonly poolsService: PoolsService,
  ) {}

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

  /** Arbre du tournoi à élimination directe (tours + affiches). */
  @Get('bracket')
  getBracket(@Param('leagueId') leagueId: string) {
    return this.bracketService.getBracket(leagueId);
  }

  /** Désigne manuellement le vainqueur d'une affiche nulle (tirs au but). */
  @Post('bracket/nodes/:nodeId/winner')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  setBracketWinner(
    @Param('leagueId') leagueId: string,
    @Param('nodeId') nodeId: string,
    @Body('team_id') teamId: string,
  ) {
    return this.bracketService.setWinnerManual(leagueId, nodeId, teamId);
  }

  /** Classements par poule (format POULES). */
  @Get('pools')
  getPoolStandings(@Param('leagueId') leagueId: string) {
    return this.poolsService.getPoolStandings(leagueId);
  }

  /** Génère la phase finale (bracket) à partir des qualifiés des poules. */
  @Post('final-phase')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  generateFinalPhase(@Param('leagueId') leagueId: string) {
    return this.poolsService.generateFinalPhase(leagueId);
  }
}
