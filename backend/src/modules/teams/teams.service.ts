import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { JoinByCodeDto } from './dto/join-by-code.dto';
import { UserPayload } from '../../common/types/user-payload.type';
import { NotificationsService } from '../notifications/notifications.service';

function generateInvitationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GBF-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateTeamDto, user: UserPayload) {
    let invitation_code: string;
    let attempts = 0;
    do {
      invitation_code = generateInvitationCode();
      attempts++;
      if (attempts > 20) throw new ConflictException('Impossible de générer un code unique');
    } while (await this.prisma.team.findUnique({ where: { invitation_code } }));

    return this.prisma.team.create({
      data: {
        ...dto,
        coach_id: user.id,
        invitation_code,
        members: {
          create: {
            user_id: user.id,
            role: 'captain',
            status: 'active',
            joined_at: new Date(),
          },
        },
      },
      include: { members: true, home_terrain: true },
    });
  }

  async findAll(query: { search?: string; city?: string }) {
    return this.prisma.team.findMany({
      where: {
        AND: [
          query.search
            ? { name: { contains: query.search, mode: 'insensitive' } }
            : {},
          query.city ? { city: query.city } : {},
        ],
      },
      include: {
        _count: { select: { members: true } },
        home_terrain: { select: { id: true, name: true, city: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, full_name: true, avatar_url: true, position: true } } },
        },
        home_terrain: true,
        tournaments: { include: { tournament: { select: { id: true, name: true, status: true } } } },
      },
    });
    if (!team) throw new NotFoundException('Équipe introuvable');
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, user: UserPayload) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Équipe introuvable');
    const isStaff = !['player', 'fan'].includes((user.role ?? '').toLowerCase());
    if (team.coach_id !== user.id && !isStaff) {
      throw new ForbiddenException('Seul le capitaine ou un administrateur peut modifier l\'équipe');
    }

    return this.prisma.team.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
      include: { home_terrain: true },
    });
  }

  async remove(id: string, user: UserPayload) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Équipe introuvable');
    if (team.coach_id !== user.id) throw new ForbiddenException('Seul le capitaine peut supprimer l\'équipe');

    await this.prisma.team.delete({ where: { id } });
    return { message: 'Équipe supprimée' };
  }

  async getMembers(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Équipe introuvable');

    return this.prisma.teamMember.findMany({
      where: { team_id: teamId },
      include: {
        user: { select: { id: true, full_name: true, username: true, avatar_url: true, position: true } },
      },
    });
  }

  async joinByCode(dto: JoinByCodeDto, user: UserPayload) {
    const team = await this.prisma.team.findUnique({
      where: { invitation_code: dto.invitation_code },
      include: { _count: { select: { members: true } } },
    });
    if (!team) throw new NotFoundException('Code d\'invitation invalide');

    await this.assertNoLeagueParticipationConflict(this.prisma, team.id, user.id);

    const existing = await this.prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: team.id, user_id: user.id } },
    });
    if (existing) throw new ConflictException('Tu es déjà membre de cette équipe');

    const member = await this.prisma.teamMember.create({
      data: {
        team_id: team.id,
        user_id: user.id,
        role: 'player',
        status: 'pending',
      },
    });

    // Notifier le capitaine de la nouvelle demande.
    if (team.coach_id) {
      const requester = await this.prisma.profile.findUnique({
        where: { id: user.id },
        select: { full_name: true },
      });
      const who = requester?.full_name?.trim() || 'Un joueur';
      await this.notifications.notify(team.coach_id, {
        type: 'team_join_request',
        title: 'Nouvelle demande d\'adhésion',
        body: `${who} souhaite rejoindre ${team.name}.`,
        data: { team_id: team.id, member_id: member.id },
      });
    }

    return { team: { id: team.id, name: team.name }, member };
  }

  async leaveTeam(teamId: string, user: UserPayload) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Équipe introuvable');
    if (team.coach_id === user.id) throw new BadRequestException('Le capitaine ne peut pas quitter son équipe');

    const member = await this.prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: user.id } },
    });
    if (!member) throw new NotFoundException('Tu n\'es pas membre de cette équipe');

    await this.prisma.teamMember.delete({
      where: { team_id_user_id: { team_id: teamId, user_id: user.id } },
    });
    // Quitter l'équipe libère sa place dans chacune de ses ligues. Un joueur
    // peut ensuite représenter une autre équipe dans cette même ligue, tant que
    // les règles de calendrier/composition de la ligue le permettent.
    await this.prisma.leaguePlayerRegistration.deleteMany({
      where: { team_id: teamId, user_id: user.id },
    });

    return { message: 'Tu as quitté l\'équipe' };
  }

  /**
   * Transfert du capitanat vers un autre membre de l'équipe.
   * Seul le capitaine actuel (ou un staff/admin) peut le faire.
   */
  async transferCaptaincy(teamId: string, newCaptainUserId: string, user: UserPayload) {
    const team = await this.assertCaptain(teamId, user);
    if (!newCaptainUserId) throw new BadRequestException('Nouveau capitaine manquant');
    if (newCaptainUserId === team.coach_id) {
      throw new BadRequestException('Ce joueur est déjà capitaine.');
    }

    const target = await this.prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: newCaptainUserId } },
      include: { user: { select: { full_name: true } } },
    });
    if (!target || target.status !== 'active') {
      throw new BadRequestException('Le nouveau capitaine doit être un membre actif de l\'équipe.');
    }

    const previousCoachId = team.coach_id;
    await this.prisma.$transaction(async (tx) => {
      await tx.team.update({ where: { id: teamId }, data: { coach_id: newCaptainUserId } });
      await tx.teamMember.update({
        where: { team_id_user_id: { team_id: teamId, user_id: newCaptainUserId } },
        data: { role: 'captain' },
      });
      if (previousCoachId) {
        await tx.teamMember.updateMany({
          where: { team_id: teamId, user_id: previousCoachId },
          data: { role: 'player' },
        });
      }
    });

    // Notifier le nouveau capitaine.
    await this.notifications.notify(newCaptainUserId, {
      type: 'team_captaincy',
      title: 'Tu es maintenant capitaine',
      body: `Tu as reçu le capitanat de ${team.name}.`,
      data: { team_id: teamId },
    });

    return { success: true, team_id: teamId, captain_id: newCaptainUserId };
  }

  /** Vérifie que l'utilisateur est le capitaine (coach_id) de l'équipe, ou un staff/admin. */
  private async assertCaptain(teamId: string, user: UserPayload) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Équipe introuvable');
    const isStaff = !['player', 'fan'].includes((user.role ?? '').toLowerCase());
    if (team.coach_id !== user.id && !isStaff) {
      throw new ForbiddenException('Seul le capitaine peut gérer les demandes');
    }
    return team;
  }

  /** Demandes d'adhésion en attente (status = pending) — capitaine uniquement. */
  async getJoinRequests(teamId: string, user: UserPayload) {
    await this.assertCaptain(teamId, user);
    return this.prisma.teamMember.findMany({
      where: { team_id: teamId, status: 'pending' },
      include: {
        user: { select: { id: true, full_name: true, username: true, avatar_url: true, position: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /** Accepte une demande : status pending → active. */
  async approveMember(teamId: string, memberId: string, user: UserPayload) {
    const team = await this.assertCaptain(teamId, user);
    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member || member.team_id !== teamId) throw new NotFoundException('Demande introuvable');
    if (member.status === 'active') return member;
    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await this.assertNoLeagueParticipationConflict(tx, teamId, member.user_id);
        const teamLeagues = await tx.tournamentTeam.findMany({
          where: { team_id: teamId },
          select: { tournament_id: true },
        });
        const activated = await tx.teamMember.update({
          where: { id: memberId },
          data: { status: 'active', joined_at: new Date() },
          include: { user: { select: { id: true, full_name: true, avatar_url: true, position: true } } },
        });
        if (teamLeagues.length > 0) {
          await tx.leaguePlayerRegistration.createMany({
            data: teamLeagues.map((league) => ({
              tournament_id: league.tournament_id,
              team_id: teamId,
              user_id: member.user_id,
            })),
          });
        }
        return activated;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce joueur participe déjà à cette ligue avec une autre équipe.');
      }
      throw error;
    }
    await this.notifications.notify(member.user_id, {
      type: 'team_join_approved',
      title: 'Demande acceptée 🎉',
      body: `Tu fais maintenant partie de ${team.name}.`,
      data: { team_id: teamId },
    });
    return updated;
  }

  /** Refuse une demande : suppression du membre pending. */
  async rejectMember(teamId: string, memberId: string, user: UserPayload) {
    const team = await this.assertCaptain(teamId, user);
    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member || member.team_id !== teamId) throw new NotFoundException('Demande introuvable');
    if (member.role === 'captain') throw new BadRequestException('Impossible de retirer le capitaine');
    await this.prisma.teamMember.delete({ where: { id: memberId } });
    await this.notifications.notify(member.user_id, {
      type: 'team_join_rejected',
      title: 'Demande non retenue',
      body: `Ta demande pour rejoindre ${team.name} n'a pas été acceptée.`,
      data: { team_id: teamId },
    });
    return { message: 'Demande refusée' };
  }

  async findByInvitationCode(code: string) {
    const team = await this.prisma.team.findUnique({
      where: { invitation_code: code },
      include: {
        _count: { select: { members: true } },
        home_terrain: { select: { id: true, name: true, city: true } },
      },
    });
    if (!team) throw new NotFoundException('Code d\'invitation invalide');
    return team;
  }

  /**
   * Cherche une participation existante du joueur dans l'une des ligues de
   * l'équipe cible. La vérification s'appuie sur les membres actifs ET sur le
   * verrou de participation afin de couvrir l'historique et la concurrence.
   */
  private async assertNoLeagueParticipationConflict(
    db: Prisma.TransactionClient | PrismaService,
    targetTeamId: string,
    userId: string,
  ) {
    const targetRegistrations = await db.tournamentTeam.findMany({
      where: { team_id: targetTeamId },
      select: { tournament_id: true, tournament: { select: { name: true } } },
    });
    if (targetRegistrations.length === 0) return;
    const tournamentIds = targetRegistrations.map((registration) => registration.tournament_id);

    const [membershipConflict, lockConflict] = await Promise.all([
      db.tournamentTeam.findFirst({
        where: {
          tournament_id: { in: tournamentIds },
          team_id: { not: targetTeamId },
          team: { members: { some: { user_id: userId, status: 'active' } } },
        },
        include: { team: { select: { name: true } }, tournament: { select: { name: true } } },
      }),
      db.leaguePlayerRegistration.findFirst({
        where: {
          tournament_id: { in: tournamentIds },
          user_id: userId,
          team_id: { not: targetTeamId },
        },
        include: { team: { select: { name: true } }, tournament: { select: { name: true } } },
      }),
    ]);
    const conflict = membershipConflict ?? lockConflict;
    if (conflict) {
      throw new ConflictException(`Tu participes déjà à ${conflict.tournament.name} avec ${conflict.team.name}.`);
    }
  }
}
