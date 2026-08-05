import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { AuthModule } from '../auth/auth.module';
import { PartnerAccessModule } from '../partner-access/partner-access.module';

@Module({
  imports: [AuthModule, PartnerAccessModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
