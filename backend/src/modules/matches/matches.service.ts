import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { ChangeMatchStatusDto } from './dto/change-status.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { ForbiddenException } from '@nestjs/common';

interface LineupPlayerInput {
  name?: string;
  role?: string;
  number?: number | null;
  position?: string | null;
  user_id?: string | null;
}

const MATCH_INCLUDE = {
  home_team: { select: { id: true, name: true, logo_url: true, primary_color: true } },
  away_team: { select: { id: true, name: true, logo_url: true, primary_color: true } },
  tournament: { select: { id: true, name: true } },
  referee: { select: { id: true, full_name: true } },
} as const;

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** IDs des membres actifs des deux équipes d'un match. */
  private async matchMemberIds(homeTeamId?: string | null, awayTeamId?: string | null): Promise<string[]> {
    const ids = [homeTeamId, awayTeamId].filter((v): v is string => !!v);
    if (ids.length === 0) return [];
    const members = await this.prisma.teamMember.findMany({
      where: { team_id: { in: ids }, status: 'active' },
      select: { user_id: true },
    });
    return members.map((m) => m.user_id);
  }

  findAll(query: { tournament_id?: string; status?: string; date?: string }) {
    return this.prisma.match.findMany({
      where: {
        ...(query.tournament_id ? { tournament_id: query.tournament_id } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.date
          ? {
              scheduled_at: {
                gte: new Date(`${query.date}T00:00:00`),
                lt: new Date(`${query.date}T23:59:59`),
              },
            }
          : {}),
      },
      include: MATCH_INCLUDE,
      orderBy: [{ round: 'asc' }, { scheduled_at: 'asc' }],
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        ...MATCH_INCLUDE,
        events: {
          include: {
            team: { select: { id: true, name: true } },
            player: { select: { id: true, full_name: true, avatar_url: true, position: true } },
          },
          orderBy: { minute: 'asc' },
        },
      },
    });
    if (!match) throw new NotFoundException('Match introuvable');
    const teamIds = [match.home_team_id, match.away_team_id].filter((teamId): teamId is string => Boolean(teamId));
    const members = teamIds.length
      ? await this.prisma.teamMember.findMany({
          where: { team_id: { in: teamIds }, status: 'active' },
          select: {
            team_id: true,
            jersey_num: true,
            role: true,
            user: { select: { id: true, full_name: true, avatar_url: true, position: true, city: true } },
          },
          orderBy: { joined_at: 'asc' },
        })
      : [];
    return {
      ...match,
      squads: {
        home: members.filter((member) => member.team_id === match.home_team_id),
        away: members.filter((member) => member.team_id === match.away_team_id),
      },
    };
  }

  /** L'utilisateur est-il capitaine de l'équipe (coach_id ou membre capitaine actif) ou staff ? */
  private async canManageTeam(teamId: string, user: UserPayload): Promise<boolean> {
    const isStaff = !['player', 'fan'].includes((user.role ?? '').toLowerCase());
    if (isStaff) return true;
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { coach_id: true } });
    if (team?.coach_id === user.id) return true;
    const captain = await this.prisma.teamMember.findFirst({
      where: { team_id: teamId, user_id: user.id, role: 'captain', status: 'active' },
      select: { id: true },
    });
    return !!captain;
  }

  /** Compositions des deux équipes d'un match (publiées, + brouillon du capitaine). */
  async getLineups(matchId: string, user: UserPayload) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true, scheduled_at: true,
        home_team: { select: { id: true, name: true } },
        away_team: { select: { id: true, name: true } },
        lineups: { select: { team_id: true, formation: true, players: true, published_at: true } },
      },
    });
    if (!match) throw new NotFoundException('Match introuvable');

    const build = async (team: { id: string; name: string } | null) => {
      if (!team) return null;
      const row = match.lineups.find((l) => l.team_id === team.id) ?? null;
      const editable = await this.canManageTeam(team.id, user);
      const published = !!row?.published_at;
      // Visible : composition publiée, ou brouillon si l'utilisateur gère l'équipe.
      const lineup = row && (published || editable)
        ? { formation: row.formation, players: row.players, published: published }
        : null;
      return { team, editable, lineup };
    };

    return {
      kickoff: match.scheduled_at,
      home: await build(match.home_team),
      away: await build(match.away_team),
    };
  }

  /** Publication / mise à jour de la composition d'une équipe par son capitaine. */
  async upsertLineup(
    matchId: string,
    user: UserPayload,
    dto: { team_id?: string; formation?: string; players?: LineupPlayerInput[]; publish?: boolean },
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, home_team_id: true, away_team_id: true, status: true },
    });
    if (!match) throw new NotFoundException('Match introuvable');
    if (['finished', 'TERMINÉ', 'completed'].includes(match.status)) {
      throw new BadRequestException('Le match est terminé : la composition n’est plus modifiable.');
    }

    // Détermine l'équipe cible : celle fournie (parmi les 2), sinon celle que gère l'utilisateur.
    const teamIds = [match.home_team_id, match.away_team_id];
    let teamId = dto.team_id && teamIds.includes(dto.team_id) ? dto.team_id : undefined;
    if (!teamId) {
      for (const id of teamIds) {
        if (await this.canManageTeam(id, user)) { teamId = id; break; }
      }
    }
    if (!teamId) throw new ForbiddenException('Tu dois être capitaine d’une des deux équipes pour publier la composition.');
    if (!(await this.canManageTeam(teamId, user))) {
      throw new ForbiddenException('Seul le capitaine de cette équipe peut publier sa composition.');
    }

    const players = (Array.isArray(dto.players) ? dto.players : [])
      .filter((p) => (p?.name ?? '').trim().length > 0)
      .slice(0, 30)
      .map((p) => ({
        name: String(p.name).trim().slice(0, 60),
        role: p.role === 'sub' ? 'sub' : 'starter',
        number: typeof p.number === 'number' ? p.number : null,
        position: p.position ? String(p.position).slice(0, 24) : null,
        user_id: p.user_id ?? null,
      }));

    const data = {
      formation: dto.formation?.trim().slice(0, 16) || null,
      players,
      published_at: dto.publish ? new Date() : null,
      updated_at: new Date(),
    };

    const lineup = await this.prisma.matchLineup.upsert({
      where: { match_id_team_id: { match_id: matchId, team_id: teamId } },
      create: { match_id: matchId, team_id: teamId, ...data },
      update: data,
    });

    // À la publication, notifier les membres de l'équipe.
    if (dto.publish) {
      const memberIds = await this.matchMemberIds(teamId, null);
      await this.notifications.notify(memberIds, {
        type: 'match_lineup',
        title: 'Composition publiée',
        body: 'La composition de ton équipe pour le prochain match est disponible.',
        data: { match_id: matchId, team_id: teamId },
      });
    }

    return lineup;
  }

  async create(dto: CreateMatchDto) {
    if (dto.home_team_id === dto.away_team_id) {
      throw new BadRequestException('Une équipe ne peut pas jouer contre elle-même');
    }
    const match = await this.prisma.match.create({
      data: {
        tournament_id: dto.tournament_id,
        home_team_id: dto.home_team_id,
        away_team_id: dto.away_team_id,
        scheduled_at: new Date(dto.scheduled_at),
        round: dto.round,
        venue: dto.venue,
        referee_id: dto.referee_id,
        status: dto.status ?? 'PROGRAMMÉ',
      },
      include: MATCH_INCLUDE,
    });

    const memberIds = await this.matchMemberIds(match.home_team_id, match.away_team_id);
    const when = match.scheduled_at
      ? new Date(match.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';
    await this.notifications.notify(memberIds, {
      type: 'match_scheduled',
      title: 'Nouveau match programmé',
      body: `${match.home_team?.name ?? 'Domicile'} vs ${match.away_team?.name ?? 'Extérieur'}${when ? ` — ${when}` : ''}.`,
      data: { match_id: match.id, tournament_id: match.tournament_id },
    });

    return match;
  }

  async update(id: string, dto: UpdateMatchDto) {
    await this.ensureExists(id);
    return this.prisma.match.update({
      where: { id },
      data: {
        ...(dto.scheduled_at ? { scheduled_at: new Date(dto.scheduled_at) } : {}),
        ...(dto.round !== undefined ? { round: dto.round } : {}),
        ...(dto.venue !== undefined ? { venue: dto.venue } : {}),
        ...(dto.referee_id !== undefined ? { referee_id: dto.referee_id } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        updated_at: new Date(),
      },
      include: MATCH_INCLUDE,
    });
  }

  /** Changement de statut avec horodatage automatique (coup d'envoi / fin). */
  async changeStatus(id: string, dto: ChangeMatchStatusDto) {
    await this.ensureExists(id);
    const data: Record<string, unknown> = { status: dto.status, updated_at: new Date() };
    if (dto.status === 'EN_COURS') data.started_at = new Date();
    if (dto.status === 'TERMINÉ' || dto.status === 'VALIDÉ') data.finished_at = new Date();
    const match = await this.prisma.match.update({ where: { id }, data, include: MATCH_INCLUDE });

    // Résultat validé → notifier les deux équipes avec le score.
    if (dto.status === 'VALIDÉ' || dto.status === 'TERMINÉ') {
      const memberIds = await this.matchMemberIds(match.home_team_id, match.away_team_id);
      await this.notifications.notify(memberIds, {
        type: 'match_result',
        title: 'Résultat du match',
        body: `${match.home_team?.name ?? 'Domicile'} ${match.home_score ?? 0} - ${match.away_score ?? 0} ${match.away_team?.name ?? 'Extérieur'}.`,
        data: { match_id: match.id, tournament_id: match.tournament_id },
      });
    }

    return match;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.match.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Événements de match ─────────────────────────────────────────────────
  getEvents(matchId: string) {
    return this.prisma.matchEvent.findMany({
      where: { match_id: matchId },
      include: {
        team: { select: { id: true, name: true } },
        player: { select: { id: true, full_name: true, avatar_url: true, position: true } },
      },
      orderBy: { minute: 'asc' },
    });
  }

  /** Ajoute un événement. Un but incrémente le score (et crée la passe décisive). */
  async addEvent(matchId: string, dto: CreateEventDto) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match introuvable');

    const isGoal = dto.type === 'BUT' || dto.type === 'CSC';

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.matchEvent.create({
        data: {
          match_id: matchId,
          team_id: dto.team_id,
          player_id: dto.player_id,
          type: dto.type,
          minute: dto.minute,
          note: dto.note,
        },
      });

      // Passe décisive → événement PASSE additionnel.
      if (dto.type === 'BUT' && dto.assist_player_id) {
        await tx.matchEvent.create({
          data: {
            match_id: matchId,
            team_id: dto.team_id,
            player_id: dto.assist_player_id,
            type: 'PASSE',
            minute: dto.minute,
          },
        });
      }

      // Mise à jour du score. Un CSC compte pour l'équipe adverse.
      if (isGoal) {
        const scoringTeamIsHome =
          dto.type === 'CSC'
            ? dto.team_id === match.away_team_id
            : dto.team_id === match.home_team_id;
        await tx.match.update({
          where: { id: matchId },
          data: scoringTeamIsHome
            ? { home_score: { increment: 1 } }
            : { away_score: { increment: 1 } },
        });
      }

      return event;
    });
  }

  /** Supprime un événement (et décrémente le score si c'était un but). */
  async removeEvent(matchId: string, eventId: string) {
    const event = await this.prisma.matchEvent.findFirst({
      where: { id: eventId, match_id: matchId },
    });
    if (!event) throw new NotFoundException('Événement introuvable');
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });

    return this.prisma.$transaction(async (tx) => {
      await tx.matchEvent.delete({ where: { id: eventId } });
      if ((event.type === 'BUT' || event.type === 'CSC') && match) {
        const scoringTeamIsHome =
          event.type === 'CSC'
            ? event.team_id === match.away_team_id
            : event.team_id === match.home_team_id;
        await tx.match.update({
          where: { id: matchId },
          data: scoringTeamIsHome
            ? { home_score: { decrement: 1 } }
            : { away_score: { decrement: 1 } },
        });
      }
      return { ok: true };
    });
  }

  // ─── Top buteurs / passeurs d'un tournoi ─────────────────────────────────
  async topScorers(tournamentId: string) {
    const matches = await this.prisma.match.findMany({
      where: { tournament_id: tournamentId },
      select: { id: true },
    });
    const matchIds = matches.map((m) => m.id);
    if (matchIds.length === 0) return { scorers: [], assisters: [] };

    const build = async (type: string) => {
      const rows = await this.prisma.matchEvent.groupBy({
        by: ['player_id'],
        where: { match_id: { in: matchIds }, type, player_id: { not: null } },
        _count: { player_id: true },
      });
      const playerIds = rows.flatMap((row) => row.player_id ? [row.player_id] : []);
      const players = playerIds.length
        ? await this.prisma.profile.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, full_name: true, avatar_url: true },
          })
        : [];
      const playersById = new Map(players.map((player) => [player.id, player]));
      return rows
        .map((row) => ({
          player: row.player_id ? playersById.get(row.player_id) ?? null : null,
          count: row._count.player_id,
        }))
        .filter((x) => x.player)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };

    return { scorers: await build('BUT'), assisters: await build('PASSE') };
  }

  private async ensureExists(id: string) {
    const m = await this.prisma.match.findUnique({ where: { id }, select: { id: true } });
    if (!m) throw new NotFoundException('Match introuvable');
  }

  /* ─── Contrôle du match (contrôleur + phase de déroulement) ─────────────
     Les colonnes `controller_name` et `phase` sont accédées en SQL brut pour
     éviter une régénération du client Prisma. */

  async getControl(id: string): Promise<{ controller_name: string | null; phase: string | null; status: string }> {
    await this.ensureExists(id);
    const rows = await this.prisma.$queryRaw<
      { controller_name: string | null; phase: string | null; status: string }[]
    >`SELECT controller_name, phase, status FROM matches WHERE id = ${id}::uuid`;
    return rows[0];
  }

  async setController(id: string, firstName: string, lastName: string) {
    await this.ensureExists(id);
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    await this.prisma.$executeRaw`
      UPDATE matches SET controller_name = ${name}, updated_at = now() WHERE id = ${id}::uuid
    `;
    return { controller_name: name };
  }

  // Phases autorisées → effet éventuel sur le statut du match.
  private static readonly PHASE_STATUS: Record<string, string> = {
    PREMIERE_MP: ", status = 'EN_COURS', started_at = COALESCE(started_at, now())",
    ARRET_JEU: '',
    ADDITIONNEL_1: '',
    MI_TEMPS: '',
    DEUXIEME_MP: '',
    ADDITIONNEL_2: '',
    TERMINE: ", status = 'TERMINÉ', finished_at = now()",
  };

  async setPhase(id: string, phase: string) {
    await this.ensureExists(id);
    const extra = MatchesService.PHASE_STATUS[phase];
    if (extra === undefined) throw new BadRequestException('Phase invalide');
    // `phase` est validé par whitelist, `extra` provient de branches contrôlées,
    // `id` est paramétré → requête sûre.
    await this.prisma.$executeRawUnsafe(
      `UPDATE matches SET phase = $1, updated_at = now()${extra} WHERE id = $2::uuid`,
      phase,
      id,
    );
    return this.getControl(id);
  }
}
