import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
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

    return { message: 'Tu as quitté l\'équipe' };
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
    const updated = await this.prisma.teamMember.update({
      where: { id: memberId },
      data: { status: 'active', joined_at: new Date() },
      include: { user: { select: { id: true, full_name: true, avatar_url: true, position: true } } },
    });
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
}
