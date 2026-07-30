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
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { JoinByCodeDto } from './dto/join-by-code.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';

@UseGuards(SupabaseAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: UserPayload) {
    return this.teamsService.create(dto, user);
  }

  @Get()
  findAll(@Query('search') search?: string, @Query('city') city?: string) {
    return this.teamsService.findAll({ search, city });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.teamsService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.teamsService.remove(id, user);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.teamsService.getMembers(id);
  }

  @Get(':id/requests')
  getJoinRequests(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.teamsService.getJoinRequests(id, user);
  }

  @Post(':id/members/:memberId/approve')
  approveMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.teamsService.approveMember(id, memberId, user);
  }

  @Delete(':id/members/:memberId/reject')
  rejectMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.teamsService.rejectMember(id, memberId, user);
  }

  @Delete(':id/leave')
  leave(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.teamsService.leaveTeam(id, user);
  }

  @Post('join-by-code')
  joinByCode(@Body() dto: JoinByCodeDto, @CurrentUser() user: UserPayload) {
    return this.teamsService.joinByCode(dto, user);
  }

  @Get('lookup/code/:code')
  findByCode(@Param('code') code: string) {
    return this.teamsService.findByInvitationCode(code);
  }
}
