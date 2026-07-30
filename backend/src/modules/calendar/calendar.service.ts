import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface RoundMatch {
  home_team_id: string;
  away_team_id: string;
  round: number;
  venue_terrain_id: string | null;
  tournament_id: string;
  scheduled_at: Date;
  venue: string | null;
}

function generateRoundRobin(teamIds: string[]): Array<{ home: string; away: string; round: number }> {
  const n = teamIds.length;
  const teams = [...teamIds];
  // Pad to even count with a BYE if needed
  if (n % 2 !== 0) teams.push('BYE');

  const totalTeams = teams.length;
  const rounds = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;
  const schedule: Array<{ home: string; away: string; round: number }> = [];

  const fixed = teams[0];
  const rotating = teams.slice(1);

  for (let round = 0; round < rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      let home: string, away: string;
      if (match === 0) {
        home = fixed;
        away = rotating[round % (totalTeams - 1)];
      } else {
        const homeIdx = (round + match) % (totalTeams - 1);
        const awayIdx = (round + totalTeams - 1 - match) % (totalTeams - 1);
        home = rotating[homeIdx];
        away = rotating[awayIdx];
      }
      if (home !== 'BYE' && away !== 'BYE') {
        // Alternate home/away per team across rounds
        const isEvenRound = round % 2 === 0;
        schedule.push({
          home: isEvenRound ? home : away,
          away: isEvenRound ? away : home,
          round: round + 1,
        });
      }
    }
  }

  return schedule;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCalendar(leagueId: string) {
    const league = await this.prisma.tournament.findUnique({
      where: { id: leagueId },
      include: {
        teams: {
          include: {
            team: {
              include: { home_terrain: true },
            },
          },
        },
        matches: true,
      },
    });

    if (!league) throw new NotFoundException('Ligue introuvable');

    if (!['INSCRIPTIONS_CLOSES', 'INSCRIPTIONS_OUVERTES'].includes(league.status)) {
      throw new BadRequestException(
        'Le calendrier ne peut être généré que si la ligue est en statut INSCRIPTIONS_OUVERTES ou INSCRIPTIONS_CLOSES',
      );
    }

    if (league.matches.length > 0) {
      throw new ConflictException('Le calendrier a déjà été généré pour cette ligue');
    }

    if (league.teams.length < 2) {
      throw new BadRequestException('La ligue doit avoir au moins 2 équipes pour générer un calendrier');
    }

    const teamIds = league.teams.map((t) => t.team_id);
    const teamMap = new Map(league.teams.map((t) => [t.team_id, t.team]));

    const schedule = generateRoundRobin(teamIds);

    const startDate = new Date(league.start_date);
    const matchDayIntervalDays = 7;

    const matches: RoundMatch[] = schedule.map((m) => {
      const homeTeam = teamMap.get(m.home);
      const venueTerrain = homeTeam?.home_terrain_id ?? null;

      const scheduledAt = addDays(startDate, (m.round - 1) * matchDayIntervalDays);
      scheduledAt.setHours(16, 0, 0, 0);

      return {
        home_team_id: m.home,
        away_team_id: m.away,
        round: m.round,
        venue_terrain_id: venueTerrain,
        scheduled_at: scheduledAt,
        tournament_id: leagueId,
        venue: homeTeam?.home_terrain?.name ?? null,
      };
    });

    await this.prisma.$transaction(
      matches.map((m) =>
        this.prisma.match.create({
          data: {
            tournament_id: m.tournament_id,
            home_team_id: m.home_team_id,
            away_team_id: m.away_team_id,
            round: m.round,
            scheduled_at: m.scheduled_at,
            status: 'PROGRAMMÉ',
            venue: m.venue,
          },
        }),
      ),
    );

    if (league.status === 'INSCRIPTIONS_OUVERTES' || league.status === 'INSCRIPTIONS_CLOSES') {
      await this.prisma.tournament.update({
        where: { id: leagueId },
        data: { status: 'INSCRIPTIONS_CLOSES', updated_at: new Date() },
      });
    }

    return {
      message: `Calendrier généré: ${matches.length} matchs sur ${Math.max(...schedule.map((m) => m.round))} journées`,
      matches_count: matches.length,
      rounds: Math.max(...schedule.map((m) => m.round)),
    };
  }

  async getCalendar(leagueId: string, round?: number) {
    const league = await this.prisma.tournament.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Ligue introuvable');

    const matches = await this.prisma.match.findMany({
      where: {
        tournament_id: leagueId,
        ...(round ? { round } : {}),
      },
      include: {
        home_team: { select: { id: true, name: true, logo_url: true, primary_color: true } },
        away_team: { select: { id: true, name: true, logo_url: true, primary_color: true } },
        referee: { select: { id: true, full_name: true } },
      },
      orderBy: [{ round: 'asc' }, { scheduled_at: 'asc' }],
    });

    const byRound = matches.reduce<Record<number, typeof matches>>((acc, m) => {
      const r = m.round ?? 0;
      if (!acc[r]) acc[r] = [];
      acc[r].push(m);
      return acc;
    }, {});

    return { league: { id: league.id, name: league.name, status: league.status }, rounds: byRound };
  }

  /** Publie le calendrier (rend les matchs visibles) : PROGRAMMÉ → PUBLIÉ.
      Optionnellement limité à une journée. */
  async publishCalendar(leagueId: string, round?: number) {
    const league = await this.prisma.tournament.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Ligue introuvable');

    const result = await this.prisma.match.updateMany({
      where: {
        tournament_id: leagueId,
        ...(round ? { round } : {}),
        status: { notIn: ['TERMINÉ', 'VALIDÉ', 'ANNULÉ', 'PUBLIÉ'] },
      },
      data: { status: 'PUBLIÉ', updated_at: new Date() },
    });
    return { published: result.count };
  }

  /** Dépublie : PUBLIÉ → PROGRAMMÉ (retire de la visibilité publique). */
  async unpublishCalendar(leagueId: string, round?: number) {
    const league = await this.prisma.tournament.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Ligue introuvable');

    const result = await this.prisma.match.updateMany({
      where: {
        tournament_id: leagueId,
        ...(round ? { round } : {}),
        status: 'PUBLIÉ',
      },
      data: { status: 'PROGRAMMÉ', updated_at: new Date() },
    });
    return { unpublished: result.count };
  }
}
