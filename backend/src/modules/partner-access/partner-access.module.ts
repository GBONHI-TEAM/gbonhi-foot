import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartnerAccessController } from './partner-access.controller';
import { PartnerAccessService } from './partner-access.service';

@Module({
  imports: [AuthModule],
  controllers: [PartnerAccessController],
  providers: [PartnerAccessService],
  exports: [PartnerAccessService],
})
export class PartnerAccessModule {}
