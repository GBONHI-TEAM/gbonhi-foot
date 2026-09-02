import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UserPayload } from '../../common/types/user-payload.type';
import type { TrackActivityDto } from './dto/track-activity.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(user: UserPayload, dto: TrackActivityDto) {
    return this.prisma.userActivityEvent.create({
      data: { user_id: user.id, type: dto.type, mode: dto.mode, metadata: dto.metadata },
      select: { id: true, type: true, mode: true, occurred_at: true },
    });
  }

  async journeyOverview(limit = 100, from?: string, to?: string) {
    // Fenêtre de période optionnelle : scope les sessions (événements) et le
    // funnel (comptes créés) pour que les filtres KPI Jour/Semaine/Mois/Période
    // agissent réellement sur les chiffres.
    const start = from ? new Date(`${from}T00:00:00.000Z`) : null;
    const end = to ? new Date(`${to}T23:59:59.999Z`) : null;
    const dateFilter = start || end
      ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
      : undefined;

    const users = await this.prisma.profile.findMany({
      where: dateFilter ? { created_at: dateFilter } : undefined,
      select: {
        id: true, full_name: true, username: true, role: true, position: true, created_at: true,
        team_members: { where: { status: 'active' }, select: { id: true } },
        league_participations: { select: { id: true } },
        reservations: { select: { id: true, status: true, created_at: true } },
        activity_events: { orderBy: { occurred_at: 'desc' }, take: 1, select: { type: true, mode: true, occurred_at: true } },
      },
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 250),
    });
    const eventCounts = await this.prisma.userActivityEvent.groupBy({
      by: ['type', 'mode'],
      _count: { _all: true },
      ...(dateFilter ? { where: { occurred_at: dateFilter } } : {}),
    });
    const count = (type: string, mode?: string) => eventCounts.filter((event) => event.type === type && (!mode || event.mode === mode)).reduce((sum, event) => sum + event._count._all, 0);

    const journeys = users.map((user) => ({
      id: user.id,
      name: user.full_name?.trim() || user.username?.trim() || 'Utilisateur sans nom',
      role: user.role,
      registeredAt: user.created_at,
      playerProfileCompleted: Boolean(user.position),
      teamCount: user.team_members.length,
      leagueCount: user.league_participations.length,
      reservationCount: user.reservations.length,
      confirmedReservationCount: user.reservations.filter((reservation) => reservation.status === 'confirmed' || reservation.status === 'completed').length,
      lastActivity: user.activity_events[0] ?? null,
    }));

    return {
      funnel: {
        registered: users.length,
        playerProfiles: journeys.filter((journey) => journey.playerProfileCompleted).length,
        inTeam: journeys.filter((journey) => journey.teamCount > 0).length,
        inLeague: journeys.filter((journey) => journey.leagueCount > 0).length,
        madeReservation: journeys.filter((journey) => journey.reservationCount > 0).length,
      },
      sessions: {
        total: count('LOGIN'),
        leagues: count('MODE_SELECTED', 'leagues'),
        reservation: count('MODE_SELECTED', 'reservation'),
      },
      journeys,
    };
  }

  /** Indicateurs opérationnels du BO. Les bornes sont bornées à 90 jours afin
   * de garder le dashboard rapide même lorsque la plateforme grandit. */
  async operationsOverview(from?: string, to?: string) {
    const end = this.validDate(to) ?? new Date();
    end.setHours(23, 59, 59, 999);
    const start = this.validDate(from) ?? new Date(end.getTime() - 29 * 86_400_000);
    start.setHours(0, 0, 0, 0);
    if (start > end) throw new BadRequestException('La période sélectionnée est invalide');
    if (end.getTime() - start.getTime() > 89 * 86_400_000) {
      start.setTime(end.getTime() - 89 * 86_400_000);
      start.setHours(0, 0, 0, 0);
    }

    const dateRange = { gte: start, lte: end };
    const activeLeagueStatuses = ['registration', 'REGISTRATIONS_OUVERTES', 'REGISTRATIONS_OPEN', 'INSCRIPTIONS_OUVERTES', 'INSCRIPTIONS_CLOSES', 'EN_COURS'];
    const [
      activeLeagues,
      teams,
      activeTerrains,
      usersCreated,
      matchesScheduled,
      reservations,
      reviewsCreated,
      openIncidents,
      events,
      recentReservations,
      recentLeagues,
    ] = await Promise.all([
      this.prisma.tournament.count({ where: { status: { in: activeLeagueStatuses } } }),
      this.prisma.team.count(),
      this.prisma.terrain.count({ where: { is_active: true } }),
      this.prisma.profile.findMany({ where: { created_at: dateRange }, select: { created_at: true } }),
      this.prisma.match.findMany({ where: { scheduled_at: dateRange }, select: { scheduled_at: true } }),
      this.prisma.reservation.findMany({ where: { created_at: dateRange }, select: { created_at: true, status: true } }),
      this.prisma.terrainReview.count({ where: { created_at: dateRange } }),
      this.prisma.supportTicket.count({ where: { kind: 'incident', status: { in: ['ouvert', 'en_cours'] } } }),
      this.prisma.userActivityEvent.findMany({ where: { occurred_at: dateRange }, select: { occurred_at: true } }),
      this.prisma.reservation.findMany({
        orderBy: { created_at: 'desc' }, take: 4,
        select: { id: true, status: true, created_at: true, terrain: { select: { name: true } }, user: { select: { full_name: true } } },
      }),
      this.prisma.tournament.findMany({ orderBy: { created_at: 'desc' }, take: 3, select: { id: true, name: true, created_at: true } }),
    ]);

    const series = this.operationSeries(start, end, usersCreated.map((row) => row.created_at), reservations.map((row) => row.created_at), events.map((row) => row.occurred_at));
    return {
      period: { from: start, to: end },
      summary: {
        activeLeagues,
        teams,
        activeTerrains,
        usersCreated: usersCreated.length,
        matchesScheduled: matchesScheduled.length,
        reservations: reservations.length,
        confirmedReservations: reservations.filter((row) => ['confirmed', 'completed', 'CONFIRMED', 'COMPLETED'].includes(row.status)).length,
        reviewsCreated,
        openIncidents,
      },
      series,
      recent: { reservations: recentReservations, leagues: recentLeagues },
    };
  }

  private validDate(value?: string): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private operationSeries(start: Date, end: Date, registrations: Date[], reservations: Date[], events: Date[]) {
    const buckets = new Map<string, { date: string; registrations: number; reservations: number; activity: number }>();
    for (let time = start.getTime(); time <= end.getTime(); time += 86_400_000) {
      const date = new Date(time).toISOString().slice(0, 10);
      buckets.set(date, { date, registrations: 0, reservations: 0, activity: 0 });
    }
    const add = (values: Date[], key: 'registrations' | 'reservations' | 'activity') => values.forEach((value) => {
      const bucket = buckets.get(value.toISOString().slice(0, 10));
      if (bucket) bucket[key] += 1;
    });
    add(registrations, 'registrations');
    add(reservations, 'reservations');
    add(events, 'activity');
    return [...buckets.values()];
  }
}
