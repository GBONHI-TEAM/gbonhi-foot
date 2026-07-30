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

@UseGuards(SupabaseAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: UserPayload) {
    return this.notificationsService.findMine(user);
  }

  @Get('all')
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: UserPayload) {
    return this.notificationsService.unreadCount(user);
  }

  @Post()
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
