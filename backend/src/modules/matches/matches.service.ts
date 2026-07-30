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
            player: { select: { id: true, full_name: true } },
          },
          orderBy: { minute: 'asc' },
        },
      },
    });
    if (!match) throw new NotFoundException('Match introuvable');
    return match;
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
        player: { select: { id: true, full_name: true } },
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
      const withNames = await Promise.all(
        rows.map(async (r) => {
          const player = r.player_id
            ? await this.prisma.profile.findUnique({
                where: { id: r.player_id },
                select: { id: true, full_name: true },
              })
            : null;
          return { player, count: r._count.player_id };
        }),
      );
      return withNames
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
