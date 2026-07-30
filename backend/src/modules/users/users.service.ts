import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserPayload } from '../../common/types/user-payload.type';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: UserPayload) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) throw new NotFoundException('Profil introuvable');
    return profile;
  }

  /** Liste des utilisateurs (admin BO). */
  findAll(query: { role?: string; search?: string }) {
    return this.prisma.profile.findMany({
      where: {
        ...(query.role ? { role: query.role } : {}),
        ...(query.search
          ? { full_name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      select: {
        id: true,
        full_name: true,
        username: true,
        avatar_url: true,
        role: true,
        position: true,
        city: true,
        created_at: true,
        _count: { select: { team_members: true, reservations: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async upsertOnLogin(user: UserPayload) {
    return this.prisma.profile.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        full_name: null,
        role: 'player',
      },
      update: {},
    });
  }

  /**
   * Résumé personnel du joueur connecté pour l'accueil mobile : ses équipes,
   * ses prochains matchs, ses ligues, ses stats et le nb de notifications non
   * lues. Tout est strictement rattaché au compte connecté.
   */
  async getSummary(user: UserPayload) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { user_id: user.id },
      select: { team_id: true },
    });
    const teamIds = memberships.map((m) => m.team_id);

    const [teams, upcomingMatches, tournamentTeams, goals, assists, matchesPlayed, unreadNotifications] =
      await Promise.all([
        teamIds.length
          ? this.prisma.team.findMany({
              where: { id: { in: teamIds } },
              select: { id: true, name: true, logo_url: true, primary_color: true },
            })
          : Promise.resolve([]),
        teamIds.length
          ? this.prisma.match.findMany({
              where: {
                OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
                scheduled_at: { gte: new Date() },
                status: { in: ['PROGRAMMÉ', 'PUBLIÉ', 'EN_COURS'] },
              },
              include: {
                home_team: { select: { id: true, name: true, primary_color: true } },
                away_team: { select: { id: true, name: true, primary_color: true } },
                tournament: { select: { id: true, name: true } },
              },
              orderBy: { scheduled_at: 'asc' },
              take: 5,
            })
          : Promise.resolve([]),
        teamIds.length
          ? this.prisma.tournamentTeam.findMany({
              where: { team_id: { in: teamIds } },
              include: { tournament: { select: { id: true, name: true, status: true } } },
            })
          : Promise.resolve([]),
        this.prisma.matchEvent.count({ where: { player_id: user.id, type: 'BUT' } }),
        this.prisma.matchEvent.count({ where: { player_id: user.id, type: 'PASSE' } }),
        teamIds.length
          ? this.prisma.match.count({
              where: {
                OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
                status: { in: ['TERMINÉ', 'VALIDÉ'] },
              },
            })
          : Promise.resolve(0),
        this.prisma.notification.count({ where: { user_id: user.id, read: false } }),
      ]);

    const leaguesMap = new Map<string, { id: string; name: string; status: string }>();
    for (const tt of tournamentTeams) {
      if (tt.tournament) leaguesMap.set(tt.tournament.id, tt.tournament);
    }

    return {
      teams,
      upcomingMatches,
      leagues: Array.from(leaguesMap.values()),
      stats: { goals, assists, teamsCount: teams.length, matchesPlayed, tournamentsCount: leaguesMap.size },
      unreadNotifications,
    };
  }

  async updateMe(user: UserPayload, dto: UpdateUserDto) {
    if (dto.username) {
      const existing = await this.prisma.profile.findFirst({
        where: { username: dto.username, id: { not: user.id } },
      });
      if (existing) throw new ConflictException('Ce nom d\'utilisateur est déjà pris');
    }

    return this.prisma.profile.update({
      where: { id: user.id },
      data: {
        ...dto,
        updated_at: new Date(),
      },
    });
  }
}
