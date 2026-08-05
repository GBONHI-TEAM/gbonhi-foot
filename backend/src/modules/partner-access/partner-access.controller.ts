import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/access/roles.decorator';
import { RolesGuard } from '../../common/access/roles.guard';
import type { UserPayload } from '../../common/types/user-payload.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreatePartnerAccessDto } from './dto/create-partner-access.dto';
import { CreatePartnerManagerDto } from './dto/create-partner-manager.dto';
import { UpdatePartnerAccessStatusDto } from './dto/update-partner-access-status.dto';
import { PartnerAccessService } from './partner-access.service';

@ApiTags('Partner accesses')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('partner-accesses')
export class PartnerAccessController {
  constructor(private readonly partnerAccess: PartnerAccessService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll() {
    return this.partnerAccess.findAll();
  }

  @Get('partners')
  @Roles('SUPER_ADMIN', 'ADMIN')
  findPartners() {
    return this.partnerAccess.findPartners();
  }

  @Get('me')
  findMine(@CurrentUser() user: UserPayload) {
    return this.partnerAccess.findMineAndTouch(user);
  }

  @Get('me/team')
  findMyTeam(@CurrentUser() user: UserPayload) {
    return this.partnerAccess.findOwnedTeam(user);
  }

  @Post('me/managers')
  createMyManager(@Body() dto: CreatePartnerManagerDto, @CurrentUser() user: UserPayload) {
    return this.partnerAccess.createManagerForOwner(dto, user);
  }

  @Patch('me/team/:id/status')
  updateMyManagerStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerAccessStatusDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.partnerAccess.updateManagerStatusForOwner(id, dto.status, user);
  }

  @Delete('me/team/:id')
  revokeMyManager(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.partnerAccess.revokeManagerForOwner(id, user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() dto: CreatePartnerAccessDto, @CurrentUser() actor: UserPayload) {
    return this.partnerAccess.create(dto, actor);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerAccessStatusDto,
  ) {
    return this.partnerAccess.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  revoke(@Param('id') id: string) {
    return this.partnerAccess.revoke(id);
  }
}
