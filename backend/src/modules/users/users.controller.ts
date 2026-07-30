import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UserPayload } from '../../common/types/user-payload.type';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Upsert profil au login (sync Supabase → Prisma)' })
  sync(@CurrentUser() user: UserPayload) {
    return this.usersService.upsertOnLogin(user);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des utilisateurs (admin)' })
  findAll(@Query('role') role?: string, @Query('search') search?: string) {
    return this.usersService.findAll({ role, search });
  }

  @Get('me')
  @ApiOperation({ summary: 'Récupérer mon profil' })
  getMe(@CurrentUser() user: UserPayload) {
    return this.usersService.getMe(user);
  }

  @Get('me/summary')
  @ApiOperation({ summary: 'Résumé personnel (équipes, matchs, ligues, stats)' })
  getMySummary(@CurrentUser() user: UserPayload) {
    return this.usersService.getSummary(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour mon profil' })
  updateMe(@CurrentUser() user: UserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user, dto);
  }
}
