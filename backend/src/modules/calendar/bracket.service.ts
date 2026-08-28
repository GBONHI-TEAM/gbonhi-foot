import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateBracket, bracketSizeFor } from './bracket';
import { buildScheduleConfig } from './schedule-config';
import { ScheduleConfig, findFreeSlot, addDays } from './scheduler';

interface LeagueWithTeams {
  id: string;
  start_date: Date;
  round_interval_days: number;
  match_duration_min: number;
  teams: {
    team_id: string;
    registration_at: Date;
    team: { home_terrain_id: string | null };
  }[];
}

/**
 * Gère les tournois à élimination directe : génération du tableau, création et
 * planification progressive des matchs, et propagation des vainqueurs tour
 * après tour jusqu'à la finale.
 */
@Injectable()
export class BracketService {
  constructor(private readonly prisma: PrismaService) {}

  /** Génère l'intégralité du tableau d'un tournoi (nodes + matchs du 1er tour
   *  jouables + avancement automatique des exemptés).
   *  @param explicitSeed  ordre de seeding imposé (ex. qualifiés de poules) ;
   *                       à défaut, ordre d'inscription. */
  async generate(league: LeagueWithTeams, explicitSeed?: string[]) {
    // Ordre de seeding : imposé (qualifiés) ou ordre d'inscription.
    const seededTeams =
      explicitSeed && explicitSeed.length
        ? explicitSeed
        : [...league.teams]
            .sort((a, b) => a.registration_at.getTime() - b.registration_at.getTime())
            .map((t) => t.team_id);
    const n = seededTeams.length;
    const size = bracketSizeFor(n);

    const defs = generateBracket(n);

    // seed (1-based) -> team_id réel, ou null si exempt (bye).
    const teamBySeed = (seed: number | null): string | null =>
      seed != null && seed <= n ? seededTeams[seed - 1] : null;

    // 1) Insertion des nodes (sans liens encore).
    const idByCoord = new Map<string, string>(); // `${round_size}#${slot}` -> node id
    for (const d of defs) {
      const created = await this.prisma.bracketNode.create({
        data: {
          tournament_id: league.id,
          round_name: d.round_name,
          round_size: d.round_size,
          slot: d.slot,
          home_team_id: d.round_size === size ? teamBySeed(d.home_seed) : null,
          away_team_id: d.round_size === size ? teamBySeed(d.away_seed) : null,
          home_source: d.home_source,
          away_source: d.away_source,
        },
      });
      idByCoord.set(`${d.round_size}#${d.slot}`, created.id);
    }

    // 2) Liens next_node_id.
    for (const d of defs) {
      if (d.next_round_size == null || d.next_slot == null) continue;
      const id = idByCoord.get(`${d.round_size}#${d.slot}`)!;
      const nextId = idByCoord.get(`${d.next_round_size}#${d.next_slot}`)!;
      await this.prisma.bracketNode.update({
        where: { id },
        data: { next_node_id: nextId, next_slot: d.next_feed },
      });
    }

    // 3) Config de planification + résolution du 1er tour (matchs + byes).
    const config = await buildScheduleConfig(this.prisma, league);
    const firstRoundNodes = await this.prisma.bracketNode.findMany({
      where: { tournament_id: league.id, round_size: size },
      orderBy: { slot: 'asc' },
    });

    for (const node of firstRoundNodes) {
      const home = node.home_team_id;
      const away = node.away_team_id;
      if (home && away) {
        await this.materializeNode(node.id, league.id, size, config);
      } else if (home || away) {
        // Un seul côté présent → l'autre est exempt : qualification directe.
        await this.setWinnerAndPropagate(node.id, (home ?? away)!, league.id, size, config);
      }
    }

    const created = await this.prisma.bracketNode.count({ where: { tournament_id: league.id } });
    return {
      format: 'ELIMINATION' as const,
      message: `Tableau généré : ${n} équipes, tableau de ${size} (${created} affiches, ${size - n} exempt(s) au 1er tour).`,
      nodes_count: created,
      bracket_size: size,
      byes: size - n,
    };
  }

  /** Crée + planifie le match d'un node dont les 2 équipes sont connues. */
  private async materializeNode(nodeId: string, leagueId: string, bracketSize: number, config: ScheduleConfig) {
    const node = await this.prisma.bracketNode.findUnique({ where: { id: nodeId } });
    if (!node || node.match_id || !node.home_team_id || !node.away_team_id) return;

    const roundIndex = Math.log2(bracketSize) - Math.log2(node.round_size); // 0 = 1er tour
    const targetDate = addDays(config.startDate, roundIndex * config.roundIntervalDays);
    const placement = await this.scheduleOne(
      leagueId,
      node.home_team_id,
      node.away_team_id,
      targetDate,
      config,
    );

    const match = await this.prisma.match.create({
      data: {
        tournament_id: leagueId,
        home_team_id: node.home_team_id,
        away_team_id: node.away_team_id,
        round: roundIndex + 1,
        bracket_round: node.round_name,
        bracket_slot: node.slot,
        scheduled_at: placement.scheduled_at,
        status: 'PROGRAMMÉ',
        venue: placement.venue,
        venue_terrain_id: placement.venue_terrain_id,
      },
    });
    await this.prisma.bracketNode.update({ where: { id: nodeId }, data: { match_id: match.id } });
  }

  /** Place un match unique en respectant l'occupation déjà en base. */
  private async scheduleOne(
    leagueId: string,
    homeTeamId: string,
    awayTeamId: string,
    targetDate: Date,
    config: ScheduleConfig,
  ): Promise<{ scheduled_at: Date; venue_terrain_id: string | null; venue: string | null }> {
    const existing = await this.prisma.match.findMany({
      where: { tournament_id: leagueId, venue_terrain_id: { not: null } },
      select: { venue_terrain_id: true, scheduled_at: true, home_team_id: true, away_team_id: true },
    });
    const durationHours = Math.max(1, Math.ceil(config.matchDurationMin / 60));
    const used = new Set<string>();
    const teamBusy = new Set<string>();
    for (const m of existing) {
      if (!m.venue_terrain_id) continue;
      const d = m.scheduled_at;
      const dk = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      for (let hh = d.getUTCHours(); hh < d.getUTCHours() + durationHours; hh++) {
        used.add(`${m.venue_terrain_id}|${dk}|${hh}`);
      }
      teamBusy.add(`${m.home_team_id}|${dk}`);
      teamBusy.add(`${m.away_team_id}|${dk}`);
    }

    const preferred = config.homeTerrainByTeam.get(homeTeamId) ?? null;
    const found = findFreeSlot({
      homeTeamId,
      awayTeamId,
      targetDate,
      terrains: config.terrains,
      preferredTerrainId: preferred,
      durationHours,
      used,
      teamBusy,
      maxDaySpill: 120,
    });
    if (found) {
      return { scheduled_at: found.scheduled_at, venue_terrain_id: found.venue_terrain_id, venue: found.venue };
    }
    // Repli : date cible à 16h sur le terrain préféré.
    const at = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 16));
    const name = config.terrains.find((t) => t.id === preferred)?.name ?? null;
    return { scheduled_at: at, venue_terrain_id: preferred, venue: name };
  }

  /** Désigne le vainqueur d'un node, l'injecte dans le node suivant, et crée le
   *  match suivant si ses deux équipes sont désormais connues. */
  private async setWinnerAndPropagate(
    nodeId: string,
    winnerTeamId: string,
    leagueId: string,
    bracketSize: number,
    config: ScheduleConfig,
  ) {
    const node = await this.prisma.bracketNode.findUnique({ where: { id: nodeId } });
    if (!node) return;
    await this.prisma.bracketNode.update({ where: { id: nodeId }, data: { winner_team_id: winnerTeamId } });

    if (!node.next_node_id) return; // finale : pas de suite

    const feed = node.next_slot ?? node.slot % 2; // 0 = domicile du suivant, 1 = extérieur
    await this.prisma.bracketNode.update({
      where: { id: node.next_node_id },
      data: feed === 0 ? { home_team_id: winnerTeamId } : { away_team_id: winnerTeamId },
    });

    const next = await this.prisma.bracketNode.findUnique({ where: { id: node.next_node_id } });
    if (next && next.home_team_id && next.away_team_id && !next.match_id) {
      await this.materializeNode(next.id, leagueId, bracketSize, config);
    }
  }

  /** Appelé quand un match est validé : propage le vainqueur dans le tableau.
   *  Sans effet si le match n'appartient pas à un tournoi à élimination. */
  async onMatchDecided(match: {
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    tournament_id: string | null;
  }): Promise<{ propagated: boolean; tie?: boolean }> {
    const node = await this.prisma.bracketNode.findFirst({ where: { match_id: match.id } });
    if (!node || !match.tournament_id) return { propagated: false };
    if (node.winner_team_id) return { propagated: false }; // déjà traité

    if (match.home_score === match.away_score) {
      // Égalité : le vainqueur doit être désigné manuellement (tirs au but).
      return { propagated: false, tie: true };
    }
    const winner = match.home_score > match.away_score ? match.home_team_id : match.away_team_id;

    const league = await this.loadLeagueForSchedule(match.tournament_id);
    const size = bracketSizeFor(league.teams.length);
    const config = await buildScheduleConfig(this.prisma, league);
    await this.setWinnerAndPropagate(node.id, winner, match.tournament_id, size, config);
    return { propagated: true };
  }

  /** Désignation manuelle du vainqueur d'un match nul de bracket (tirs au but). */
  async setWinnerManual(leagueId: string, nodeId: string, winnerTeamId: string) {
    const node = await this.prisma.bracketNode.findFirst({ where: { id: nodeId, tournament_id: leagueId } });
    if (!node) throw new NotFoundException('Affiche du tableau introuvable');
    if (node.home_team_id !== winnerTeamId && node.away_team_id !== winnerTeamId) {
      throw new BadRequestException('Le vainqueur doit être l’une des deux équipes de l’affiche');
    }
    const league = await this.loadLeagueForSchedule(leagueId);
    const size = bracketSizeFor(league.teams.length);
    const config = await buildScheduleConfig(this.prisma, league);
    await this.setWinnerAndPropagate(nodeId, winnerTeamId, leagueId, size, config);
    return { ok: true };
  }

  /** Arbre du tableau pour affichage (tours ordonnés + équipes/placeholders). */
  async getBracket(leagueId: string) {
    const nodes = await this.prisma.bracketNode.findMany({
      where: { tournament_id: leagueId },
      orderBy: [{ round_size: 'desc' }, { slot: 'asc' }],
    });
    if (nodes.length === 0) return { rounds: [] };

    const teamIds = [
      ...new Set(
        nodes.flatMap((n) => [n.home_team_id, n.away_team_id, n.winner_team_id].filter((v): v is string => !!v)),
      ),
    ];
    const teams = teamIds.length
      ? await this.prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true, logo_url: true, primary_color: true },
        })
      : [];
    const teamById = new Map(teams.map((t) => [t.id, t]));

    const byRound = new Map<number, typeof nodes>();
    for (const node of nodes) {
      const arr = byRound.get(node.round_size) ?? [];
      arr.push(node);
      byRound.set(node.round_size, arr);
    }

    const rounds = [...byRound.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([round_size, list]) => ({
        round_size,
        round_name: list[0].round_name,
        matches: list.map((node) => ({
          id: node.id,
          slot: node.slot,
          match_id: node.match_id,
          home: node.home_team_id ? teamById.get(node.home_team_id) ?? null : null,
          away: node.away_team_id ? teamById.get(node.away_team_id) ?? null : null,
          home_source: node.home_source,
          away_source: node.away_source,
          winner: node.winner_team_id ? teamById.get(node.winner_team_id) ?? null : null,
        })),
      }));

    return { rounds };
  }

  private async loadLeagueForSchedule(leagueId: string): Promise<LeagueWithTeams> {
    const league = await this.prisma.tournament.findUnique({
      where: { id: leagueId },
      include: { teams: { include: { team: { select: { home_terrain_id: true } } } } },
    });
    if (!league) throw new NotFoundException('Ligue introuvable');
    return {
      id: league.id,
      start_date: league.start_date,
      round_interval_days: league.round_interval_days,
      match_duration_min: league.match_duration_min,
      teams: league.teams.map((t) => ({
        team_id: t.team_id,
        registration_at: t.registration_at,
        team: { home_terrain_id: t.team.home_terrain_id },
      })),
    };
  }
}
