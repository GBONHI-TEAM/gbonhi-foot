import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  NotImplementedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateChampionship, roundsCount } from './round-robin';
import { scheduleMatches, ScheduledMatch } from './scheduler';
import { buildScheduleConfig } from './schedule-config';
import { BracketService } from './bracket.service';

/** Type de compétition normalisé à partir du champ libre `format`. */
export type CompetitionType = 'CHAMPIONNAT' | 'ELIMINATION' | 'POULES';

export function normalizeFormat(format: string | null | undefined): CompetitionType {
  const f = (format ?? '').toLowerCase();
  if (/(elim|knock|single_elimination|coupe|bracket)/.test(f)) return 'ELIMINATION';
  if (/(poule|group)/.test(f)) return 'POULES';
  return 'CHAMPIONNAT'; // round_robin par défaut
}

/** Nombre de manches (1 aller / 2 aller-retour) déduit de la config. */
function resolveLegs(format: string | null | undefined, legs: number | null | undefined): number {
  const f = (format ?? '').toLowerCase();
  if (/(home_away|aller_retour|aller-retour|retour)/.test(f)) return 2;
  return legs && legs >= 2 ? 2 : 1;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bracket: BracketService,
  ) {}

  async generateCalendar(leagueId: string) {
    const league = await this.prisma.tournament.findUnique({
      where: { id: leagueId },
      include: {
        teams: {
          include: {
            team: { include: { home_terrain: true } },
          },
        },
        matches: { select: { id: true } },
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

    const type = normalizeFormat(league.format);

    if (type === 'ELIMINATION') {
      const existingNodes = await this.prisma.bracketNode.count({ where: { tournament_id: leagueId } });
      if (existingNodes > 0) {
        throw new ConflictException('Le tableau a déjà été généré pour cette ligue');
      }
      const result = await this.bracket.generate({
        id: league.id,
        start_date: league.start_date,
        round_interval_days: league.round_interval_days,
        match_duration_min: league.match_duration_min,
        teams: league.teams.map((t) => ({
          team_id: t.team_id,
          registration_at: t.registration_at,
          team: { home_terrain_id: t.team.home_terrain_id },
        })),
      });
      await this.prisma.tournament.update({
        where: { id: leagueId },
        data: { status: 'INSCRIPTIONS_CLOSES', updated_at: new Date() },
      });
      return result;
    }
    if (type === 'POULES') {
      throw new NotImplementedException(
        "Le format « poules + phase finale » sera disponible en phase 3. Utilise « championnat » pour l'instant.",
      );
    }

    // ── CHAMPIONNAT (aller / aller-retour) ──────────────────────────────────
    const legs = resolveLegs(league.format, league.legs);
    const teamIds = league.teams.map((t) => t.team_id);

    const fixtures = generateChampionship(teamIds, legs);

    const scheduleConfig = await buildScheduleConfig(this.prisma, league);
    const scheduled = scheduleMatches(fixtures, scheduleConfig);

    await this.persistMatches(leagueId, scheduled);

    await this.prisma.tournament.update({
      where: { id: leagueId },
      data: { status: 'INSCRIPTIONS_CLOSES', updated_at: new Date() },
    });

    const rounds = roundsCount(fixtures);
    return {
      format: type,
      legs,
      message: `Calendrier généré : ${scheduled.length} matchs sur ${rounds} journées (${legs === 2 ? 'aller-retour' : 'aller simple'}).`,
      matches_count: scheduled.length,
      rounds,
      unplaced_warnings: this.collisionWarnings(scheduled),
    };
  }

  /** Détecte d'éventuels chevauchements résiduels (terrain occupé 2×). */
  private collisionWarnings(matches: ScheduledMatch[]): string[] {
    const seen = new Map<string, ScheduledMatch>();
    const warnings: string[] = [];
    for (const m of matches) {
      if (!m.venue_terrain_id) continue;
      const key = `${m.venue_terrain_id}|${m.scheduled_at.toISOString()}`;
      if (seen.has(key)) {
        warnings.push(
          `Chevauchement possible : terrain ${m.venue} occupé par 2 matchs le ${m.scheduled_at.toISOString()}.`,
        );
      } else {
        seen.set(key, m);
      }
    }
    return warnings;
  }

  /** Persiste les matchs générés en une transaction atomique. */
  private async persistMatches(leagueId: string, matches: ScheduledMatch[]) {
    await this.prisma.$transaction(
      matches.map((m) =>
        this.prisma.match.create({
          data: {
            tournament_id: leagueId,
            home_team_id: m.home_team_id,
            away_team_id: m.away_team_id,
            round: m.round,
            leg: m.leg,
            scheduled_at: m.scheduled_at,
            status: 'PROGRAMMÉ',
            venue: m.venue,
            venue_terrain_id: m.venue_terrain_id,
          },
        }),
      ),
    );
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

    return {
      league: {
        id: league.id,
        name: league.name,
        status: league.status,
        format: normalizeFormat(league.format),
        legs: resolveLegs(league.format, league.legs),
      },
      rounds: byRound,
    };
  }

  /** Publie le calendrier (rend les matchs visibles) : PROGRAMMÉ → PUBLIÉ. */
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
