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
import { IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';

class SetControllerDto {
  @IsString()
  @MaxLength(60)
  first_name: string;

  @IsString()
  @MaxLength(60)
  last_name: string;
}

class SetPhaseDto {
  @IsString()
  phase: string;
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

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTROLEUR')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeMatchStatusDto) {
    return this.matchesService.changeStatus(id, dto);
  }

  @Get(':id/control')
  getControl(@Param('id') id: string) {
    return this.matchesService.getControl(id);
  }

  @Patch(':id/controller')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTROLEUR')
  setController(@Param('id') id: string, @Body() dto: SetControllerDto) {
    return this.matchesService.setController(id, dto.first_name, dto.last_name);
  }

  @Patch(':id/phase')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTROLEUR')
  setPhase(@Param('id') id: string, @Body() dto: SetPhaseDto) {
    return this.matchesService.setPhase(id, dto.phase);
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTROLEUR')
  addEvent(@Param('id') id: string, @Body() dto: CreateEventDto) {
    return this.matchesService.addEvent(id, dto);
  }

  @Delete(':id/events/:eventId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTROLEUR')
  removeEvent(@Param('id') id: string, @Param('eventId') eventId: string) {
    return this.matchesService.removeEvent(id, eventId);
  }
}
