import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assignPools, generatePoolFixtures, crossSeedQualifiers } from './pools';
import { scheduleMatches } from './scheduler';
import { buildScheduleConfig } from './schedule-config';
import { computeStandings, StandingTeam } from './standings';
import { BracketService } from './bracket.service';
import { bracketSizeFor } from './bracket';

interface LeagueWithTeams {
  id: string;
  start_date: Date;
  round_interval_days: number;
  match_duration_min: number;
  pool_count: number | null;
  qualifiers_per_pool: number | null;
  legs: number;
  teams: {
    team_id: string;
    registration_at: Date;
    team: { id: string; name: string; logo_url: string | null; primary_color: string | null; home_terrain_id: string | null };
  }[];
}

/**
 * Format « poules + phase finale » : mini-championnats par groupe puis tableau
 * final généré à partir des qualifiés (seeding croisé rang → poule).
 */
@Injectable()
export class PoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bracket: BracketService,
  ) {}

  /** Génère la phase de poules (répartition + round-robin + planification). */
  async generate(league: LeagueWithTeams) {
    const poolCount = Math.max(2, league.pool_count ?? 2);
    if (league.teams.length < poolCount * 2) {
      throw new BadRequestException(
        `Il faut au moins ${poolCount * 2} équipes pour ${poolCount} poules (2 par poule minimum).`,
      );
    }

    // Seeding = ordre d'inscription pour une répartition équilibrée.
    const seeded = [...league.teams]
      .sort((a, b) => a.registration_at.getTime() - b.registration_at.getTime())
      .map((t) => t.team_id);

    const pools = assignPools(seeded, poolCount);
    const fixtures = generatePoolFixtures(pools, league.legs ?? 1);

    const config = await buildScheduleConfig(this.prisma, {
      start_date: league.start_date,
      round_interval_days: league.round_interval_days,
      match_duration_min: league.match_duration_min,
      teams: league.teams.map((t) => ({ team_id: t.team_id, team: { home_terrain_id: t.team.home_terrain_id } })),
    });
    const scheduled = scheduleMatches(fixtures, config);

    await this.prisma.$transaction(
      scheduled.map((m) =>
        this.prisma.match.create({
          data: {
            tournament_id: league.id,
            home_team_id: m.home_team_id,
            away_team_id: m.away_team_id,
            round: m.round,
            leg: m.leg,
            pool: m.pool ?? null,
            scheduled_at: m.scheduled_at,
            status: 'PROGRAMMÉ',
            venue: m.venue,
            venue_terrain_id: m.venue_terrain_id,
          },
        }),
      ),
    );

    await this.prisma.tournament.update({
      where: { id: league.id },
      data: { status: 'INSCRIPTIONS_CLOSES', updated_at: new Date() },
    });

    const poolSizes = [...pools.entries()].map(([label, ids]) => `${label}:${ids.length}`).join(', ');
    return {
      format: 'POULES' as const,
      message: `Phase de poules générée : ${poolCount} poules (${poolSizes}), ${scheduled.length} matchs.`,
      matches_count: scheduled.length,
      pool_count: poolCount,
    };
  }

  /** Classements groupés par poule (sur les matchs validés). */
  async getPoolStandings(leagueId: string) {
    const matches = await this.prisma.match.findMany({
      where: { tournament_id: leagueId, pool: { not: null } },
      select: {
        home_team_id: true,
        away_team_id: true,
        home_score: true,
        away_score: true,
        status: true,
        pool: true,
      },
    });
    if (matches.length === 0) return { pools: [] };

    // team_id -> poule (déduit des affiches)
    const teamPool = new Map<string, string>();
    for (const m of matches) {
      if (m.pool) {
        teamPool.set(m.home_team_id, m.pool);
        teamPool.set(m.away_team_id, m.pool);
      }
    }
    const teamIds = [...teamPool.keys()];
    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true, logo_url: true, primary_color: true },
    });
    const teamById = new Map<string, StandingTeam>(teams.map((t) => [t.id, t]));

    const validated = matches.filter((m) => {
      const s = (m.status ?? '').toUpperCase();
      return s.includes('VALID') || s.includes('TERMIN');
    });
    const labels = [...new Set([...teamPool.values()])].sort();

    const pools = labels.map((label) => {
      const poolTeams = teamIds.filter((id) => teamPool.get(id) === label).map((id) => teamById.get(id)!).filter(Boolean);
      const poolMatches = validated.filter((m) => m.pool === label);
      return { pool: label, standings: computeStandings(poolTeams, poolMatches) };
    });

    return { pools };
  }

  /** Génère la phase finale (bracket) à partir des qualifiés de chaque poule. */
  async generateFinalPhase(leagueId: string) {
    const league = await this.loadLeague(leagueId);

    const existingNodes = await this.prisma.bracketNode.count({ where: { tournament_id: leagueId } });
    if (existingNodes > 0) throw new ConflictException('La phase finale a déjà été générée');

    const poolMatches = await this.prisma.match.findMany({
      where: { tournament_id: leagueId, pool: { not: null } },
      select: { status: true },
    });
    if (poolMatches.length === 0) {
      throw new BadRequestException("Aucune phase de poules générée pour cette ligue");
    }
    const pending = poolMatches.filter((m) => !(m.status ?? '').toUpperCase().includes('VALID'));
    if (pending.length > 0) {
      throw new BadRequestException(
        `La phase de poules n'est pas terminée : ${pending.length} match(s) restent à valider.`,
      );
    }

    const { pools } = await this.getPoolStandings(leagueId);
    const poolCount = pools.length;
    const minPoolSize = Math.min(...pools.map((p) => p.standings.length));
    const wanted = Math.max(1, league.qualifiers_per_pool ?? 2);
    const perPool = Math.min(wanted, minPoolSize);

    // qualifiersByRank[r] = équipes classées (r+1)ᵉ de chaque poule (ordre A,B,…)
    const orderedPools = [...pools].sort((a, b) => a.pool.localeCompare(b.pool));
    const qualifiersByRank: string[][] = [];
    for (let r = 0; r < perPool; r++) {
      qualifiersByRank.push(orderedPools.map((p) => p.standings[r].team.id));
    }
    const seed = crossSeedQualifiers(qualifiersByRank);

    const result = await this.bracket.generate(
      {
        id: league.id,
        start_date: this.finalPhaseStart(league),
        round_interval_days: league.round_interval_days,
        match_duration_min: league.match_duration_min,
        teams: league.teams.map((t) => ({
          team_id: t.team_id,
          registration_at: t.registration_at,
          team: { home_terrain_id: t.team.home_terrain_id },
        })),
      },
      seed,
    );

    return {
      ...result,
      qualifiers: seed.length,
      qualifiers_per_pool: perPool,
      bracket_size: bracketSizeFor(seed.length),
      message: `Phase finale générée : ${seed.length} qualifiés (${perPool}/poule × ${poolCount} poules).`,
    };
  }

  /** Date de départ de la phase finale : après la dernière journée de poules. */
  private finalPhaseStart(league: LeagueWithTeams): Date {
    // On place la phase finale une semaine après le dernier match de poules
    // planifié (calculé simplement à partir de start_date + marge).
    const d = new Date(
      Date.UTC(league.start_date.getUTCFullYear(), league.start_date.getUTCMonth(), league.start_date.getUTCDate()),
    );
    // marge : nb de journées de poules estimé (approché) — la planification
    // anti-collision décale de toute façon si les créneaux sont pris.
    d.setUTCDate(d.getUTCDate() + (league.round_interval_days ?? 7) * 8);
    return d;
  }

  private async loadLeague(leagueId: string): Promise<LeagueWithTeams> {
    const league = await this.prisma.tournament.findUnique({
      where: { id: leagueId },
      include: {
        teams: {
          include: {
            team: { select: { id: true, name: true, logo_url: true, primary_color: true, home_terrain_id: true } },
          },
        },
      },
    });
    if (!league) throw new NotFoundException('Ligue introuvable');
    return {
      id: league.id,
      start_date: league.start_date,
      round_interval_days: league.round_interval_days,
      match_duration_min: league.match_duration_min,
      pool_count: league.pool_count,
      qualifiers_per_pool: league.qualifiers_per_pool,
      legs: league.legs,
      teams: league.teams.map((t) => ({
        team_id: t.team_id,
        registration_at: t.registration_at,
        team: {
          id: t.team.id,
          name: t.team.name,
          logo_url: t.team.logo_url,
          primary_color: t.team.primary_color,
          home_terrain_id: t.team.home_terrain_id,
        },
      })),
    };
  }
}
