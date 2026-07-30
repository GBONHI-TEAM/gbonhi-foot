import { Module } from '@nestjs/common';
import { TerrainsController } from './terrains.controller';
import { ReviewsController } from './reviews.controller';
import { TerrainsService } from './terrains.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TerrainsController, ReviewsController],
  providers: [TerrainsService],
  exports: [TerrainsService],
})
export class TerrainsModule {}
