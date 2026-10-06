import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WaveService } from './wave.service';

@Module({
  imports: [AuthModule, ReservationsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, WaveService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
