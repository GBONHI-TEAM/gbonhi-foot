import { Module } from '@nestjs/common';
import { TerrainsController } from './terrains.controller';
import { ReviewsController } from './reviews.controller';
import { TerrainsService } from './terrains.service';
import { AuthModule } from '../auth/auth.module';
import { PartnerAccessModule } from '../partner-access/partner-access.module';

@Module({
  imports: [AuthModule, PartnerAccessModule],
  controllers: [TerrainsController, ReviewsController],
  providers: [TerrainsService],
  exports: [TerrainsService],
})
export class TerrainsModule {}
