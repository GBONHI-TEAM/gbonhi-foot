import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsCronController } from './reservations-cron.controller';
import { ReservationsService } from './reservations.service';
import { AuthModule } from '../auth/auth.module';
import { PartnerAccessModule } from '../partner-access/partner-access.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, PartnerAccessModule, NotificationsModule],
  controllers: [ReservationsController, ReservationsCronController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
