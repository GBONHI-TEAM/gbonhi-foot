import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { ChangeMatchStatusDto } from './dto/change-status.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IsString, IsInt, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';

class SetPhaseDto {
  @IsString()
  phase: string;
}

class AutoAssignControllersDto {
  @IsUUID()
  tournament_id: string;

  @Type(() => Number)
  @IsInt()
  round: number;

  @IsOptional()
  @IsBoolean()
  reassign?: boolean;
}

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  findAll(
    @Query('tournament_id') tournamentId?: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.matchesService.findAll({ tournament_id: tournamentId, status, date });
  }

  @Get('scorers')
  topScorers(@Query('tournament_id') tournamentId: string) {
    return this.matchesService.topScorers(tournamentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  /** Compositions des deux équipes (publiées + brouillon du capitaine). */
  @Get(':id/lineups')
  getLineups(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.matchesService.getLineups(id, user);
  }

  /** Publication / mise à jour de la composition par le capitaine d'une équipe. */
  @Post(':id/lineup')
  upsertLineup(
    @Param('id') id: string,
    @Body() dto: { team_id?: string; formation?: string; players?: { name?: string; role?: string; number?: number | null; position?: string | null; user_id?: string | null }[]; publish?: boolean },
    @CurrentUser() user: UserPayload,
  ) {
    return this.matchesService.upsertLineup(id, user, dto);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  create(@Body() dto: CreateMatchDto) {
    return this.matchesService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  update(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matchesService.update(id, dto);
  }

  // Assignation AUTOMATIQUE des contrôleurs pour une journée entière.
  // Tâche d'organisation (comme l'assignation manuelle) → réservée aux rôles
  // qui gèrent le calendrier. La répartition ne concerne que les comptes
  // contrôleur.
  @Post('auto-assign-controllers')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  autoAssignControllers(@Body() dto: AutoAssignControllersDto) {
    return this.matchesService.autoAssignControllers(
      dto.tournament_id,
      dto.round,
      dto.reassign ?? false,
    );
  }

  // ── Contrôle du match (score en direct) : RÉSERVÉ aux comptes contrôleurs.
  // Le SUPER_ADMIN reste autorisé en tant que superviseur de la plateforme. Un
  // administrateur « simple » ou tout autre utilisateur est refusé (403).
  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'CONTROLEUR')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeMatchStatusDto, @CurrentUser() user: UserPayload) {
    return this.matchesService.changeStatus(id, dto, user);
  }

  @Get(':id/control')
  @Roles('SUPER_ADMIN', 'CONTROLEUR')
  getControl(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.matchesService.getControl(id, user);
  }

  // Le contrôleur s'enregistre lui-même : identité dérivée du compte connecté
  // (plus de nom libre falsifiable). Réservé au contrôleur désigné.
  @Patch(':id/controller')
  @Roles('SUPER_ADMIN', 'CONTROLEUR')
  setController(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.matchesService.setController(id, user);
  }

  @Patch(':id/phase')
  @Roles('SUPER_ADMIN', 'CONTROLEUR')
  setPhase(@Param('id') id: string, @Body() dto: SetPhaseDto, @CurrentUser() user: UserPayload) {
    return this.matchesService.setPhase(id, dto.phase, user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.matchesService.remove(id);
  }

  @Get(':id/events')
  getEvents(@Param('id') id: string) {
    return this.matchesService.getEvents(id);
  }

  @Post(':id/events')
  @Roles('SUPER_ADMIN', 'CONTROLEUR')
  addEvent(@Param('id') id: string, @Body() dto: CreateEventDto, @CurrentUser() user: UserPayload) {
    return this.matchesService.addEvent(id, dto, user);
  }

  @Delete(':id/events/:eventId')
  @Roles('SUPER_ADMIN', 'CONTROLEUR')
  removeEvent(@Param('id') id: string, @Param('eventId') eventId: string, @CurrentUser() user: UserPayload) {
    return this.matchesService.removeEvent(id, eventId, user);
  }
}
