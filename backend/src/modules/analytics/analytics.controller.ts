import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/access/roles.decorator';
import { RolesGuard } from '../../common/access/roles.guard';
import type { UserPayload } from '../../common/types/user-payload.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TrackActivityDto } from './dto/track-activity.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  track(@CurrentUser() user: UserPayload, @Body() dto: TrackActivityDto) {
    return this.analytics.track(user, dto);
  }

  @Get('user-journeys')
  @Roles('SUPER_ADMIN', 'ADMIN')
  userJourneys(@Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '100', 10);
    return this.analytics.journeyOverview(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('operations-overview')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'SUPPORT', 'OPERATEUR')
  operationsOverview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.operationsOverview(from, to);
  }
}
