import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TeamsModule } from './modules/teams/teams.module';
import { LeaguesModule } from './modules/leagues/leagues.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { MatchesModule } from './modules/matches/matches.module';
import { TerrainsModule } from './modules/terrains/terrains.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CommunityModule } from './modules/community/community.module';
import { SupportModule } from './modules/support/support.module';
import { AuditModule } from './common/audit/audit.module';
import { AuditLogInterceptor } from './common/audit/audit-log.interceptor';
import { PartnerAccessModule } from './modules/partner-access/partner-access.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Config — load .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting (mémoire — pas de Redis pour le MVP)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),

    // Core
    PrismaModule,
    AuditModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TeamsModule,
    LeaguesModule,
    CalendarModule,
    TournamentsModule,
    MatchesModule,
    TerrainsModule,
    ReservationsModule,
    PaymentsModule,
    NotificationsModule,
    FinanceModule,
    CommunityModule,
    SupportModule,
    PartnerAccessModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
})
export class AppModule {}
