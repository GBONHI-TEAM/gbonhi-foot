import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { BracketService } from './bracket.service';
import { PoolsService } from './pools.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CalendarController],
  providers: [CalendarService, BracketService, PoolsService],
  exports: [BracketService],
})
export class CalendarModule {}
