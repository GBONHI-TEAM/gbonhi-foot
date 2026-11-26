import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesCronController } from './matches-cron.controller';
import { MatchesService } from './matches.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [AuthModule, NotificationsModule, CalendarModule],
  controllers: [MatchesController, MatchesCronController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
