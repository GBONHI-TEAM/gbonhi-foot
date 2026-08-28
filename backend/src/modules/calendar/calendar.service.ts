import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  NotImplementedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateChampionship, roundsCount } from './round-robin';
import {
  scheduleMatches,
  ScheduledMatch,
  TerrainInput,
  ScheduleConfig,
} from './scheduler';

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
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotImplementedException(
        "Le format « élimination directe » sera disponible en phase 2. Utilise « championnat » pour l'instant.",
      );
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

    const scheduleConfig = await this.buildScheduleConfig(league);
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

  /** Construit la config de planification : terrains + créneaux + blocages. */
  private async buildScheduleConfig(league: {
    start_date: Date;
    round_interval_days: number;
    match_duration_min: number;
    teams: { team_id: string; team: { home_terrain_id: string | null } }[];
  }): Promise<ScheduleConfig> {
    const startDate = new Date(
      Date.UTC(
        league.start_date.getUTCFullYear(),
        league.start_date.getUTCMonth(),
        league.start_date.getUTCDate(),
      ),
    );

    const homeTerrainByTeam = new Map<string, string | null>();
    const terrainIds = new Set<string>();
    for (const t of league.teams) {
      homeTerrainByTeam.set(t.team_id, t.team.home_terrain_id);
      if (t.team.home_terrain_id) terrainIds.add(t.team.home_terrain_id);
    }

    // Pool de terrains = terrains « domicile » des équipes participantes.
    // (À défaut de créneaux configurés, le planificateur retombe sur 16h.)
    const terrains: TerrainInput[] = [];
    if (terrainIds.size > 0) {
      const rows = await this.prisma.terrain.findMany({
        where: { id: { in: [...terrainIds] }, is_active: true },
        include: {
          slots: { where: { is_active: true } },
          blocks: { where: { blocked_date: { gte: startDate } } },
        },
      });
      for (const r of rows) {
        terrains.push({
          id: r.id,
          name: r.name,
          slots: r.slots.map((s) => ({
            day_of_week: s.day_of_week,
            start_hour: s.start_hour,
            end_hour: s.end_hour,
            is_active: s.is_active,
          })),
          blocks: r.blocks.map((b) => ({
            blocked_date: b.blocked_date,
            start_hour: b.start_hour,
            end_hour: b.end_hour,
          })),
        });
      }
    }

    return {
      startDate,
      roundIntervalDays: league.round_interval_days ?? 7,
      matchDurationMin: league.match_duration_min ?? 60,
      homeTerrainByTeam,
      terrains,
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
