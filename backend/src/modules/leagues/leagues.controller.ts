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
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { RegisterTeamDto } from './dto/register-team.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  create(@Body() dto: CreateLeagueDto, @CurrentUser() user: UserPayload) {
    return this.leaguesService.create(dto, user);
  }

  @Get()
  findAll(@Query('status') status?: string, @Query('search') search?: string) {
    return this.leaguesService.findAll({ status, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leaguesService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  update(@Param('id') id: string, @Body() dto: UpdateLeagueDto) {
    return this.leaguesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.leaguesService.changeStatus(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.leaguesService.remove(id);
  }

  @Post(':id/teams')
  registerTeam(@Param('id') id: string, @Body() dto: RegisterTeamDto, @CurrentUser() user: UserPayload) {
    return this.leaguesService.registerTeam(id, dto, user);
  }

  @Get(':id/my-registration')
  getMyRegistration(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.leaguesService.getMyRegistration(id, user);
  }

  @Get(':id/standings')
  getStandings(@Param('id') id: string) {
    return this.leaguesService.getStandings(id);
  }
}
