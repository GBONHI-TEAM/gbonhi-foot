import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateAdminInvitationDto } from './dto/create-admin-invitation.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UserPayload } from '../../common/types/user-payload.type';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Upsert profil au login (sync Supabase → Prisma)' })
  sync(@CurrentUser() user: UserPayload) {
    return this.usersService.upsertOnLogin(user);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Liste des utilisateurs (admin)' })
  findAll(@Query('role') role?: string, @Query('search') search?: string) {
    return this.usersService.findAll({ role, search });
  }

  @Get('me')
  @ApiOperation({ summary: 'Récupérer mon profil' })
  getMe(@CurrentUser() user: UserPayload) {
    return this.usersService.getMe(user);
  }

  @Get('admin-members')
  @Roles('SUPER_ADMIN')
  adminMembers() {
    return this.usersService.findAdminMembers();
  }

  @Post('admin-invitations')
  @Roles('SUPER_ADMIN')
  inviteAdmin(@Body() dto: CreateAdminInvitationDto) {
    return this.usersService.inviteAdmin(dto);
  }

  @Get('me/summary')
  @ApiOperation({ summary: 'Résumé personnel (équipes, matchs, ligues, stats)' })
  getMySummary(@CurrentUser() user: UserPayload) {
    return this.usersService.getSummary(user);
  }

  /** Ma fiche joueur consolidée (identité + sportif + stats) pour l'app. */
  @Get('me/player-card')
  getMyPlayerCard(@CurrentUser() user: UserPayload) {
    return this.usersService.getPlayerCard(user.id);
  }

  /** Active/désactive la visibilité publique de ma carte joueur. */
  @Patch('me/player-visibility')
  setPlayerVisibility(@CurrentUser() user: UserPayload, @Body('is_public') isPublic: boolean) {
    return this.usersService.setPlayerVisibility(user.id, isPublic === true);
  }

  /** Fiche joueur consolidée pour le BO : identité, profil sportif et statistiques. */
  @Get(':id/player-card')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'SUPPORT', 'OPERATEUR')
  playerCard(@Param('id') id: string) {
    return this.usersService.getPlayerCard(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour mon profil' })
  updateMe(@CurrentUser() user: UserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user, dto);
  }

  @Patch(':id/role')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Attribuer un rôle administrateur (super admin uniquement)' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() user: UserPayload) {
    return this.usersService.updateRole(id, dto.role, user);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Supprimer définitivement mon compte et mes données personnelles' })
  deleteMe(@CurrentUser() user: UserPayload) {
    return this.usersService.deleteMe(user);
  }
}
