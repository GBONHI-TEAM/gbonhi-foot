import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: UserPayload) {
    return this.notificationsService.findMine(user);
  }

  @Get('all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: UserPayload) {
    return this.notificationsService.unreadCount(user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('token')
  registerToken(@Body() body: { token: string }, @CurrentUser() user: UserPayload) {
    return this.notificationsService.registerToken(user, body?.token ?? '');
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: UserPayload) {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.notificationsService.markRead(id, user);
  }
}
