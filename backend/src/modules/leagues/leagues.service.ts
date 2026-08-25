import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { RegisterTeamDto } from './dto/register-team.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { UserPayload } from '../../common/types/user-payload.type';
import { NotificationsService } from '../notifications/notifications.service';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ['INSCRIPTIONS_OUVERTES'],
  INSCRIPTIONS_OUVERTES: ['INSCRIPTIONS_CLOSES', 'SUSPENDUE'],
  INSCRIPTIONS_CLOSES: ['EN_COURS', 'SUSPENDUE'],
  EN_COURS: ['SUSPENDUE', 'TERMINÉE'],
  SUSPENDUE: ['EN_COURS', 'ARCHIVÉE'],
  TERMINÉE: ['ARCHIVÉE'],
  ARCHIVÉE: [],
};

@Injectable()
export class LeaguesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** IDs des membres actifs des équipes données. */
  private async activeMemberIds(teamIds: string[]): Promise<string[]> {
    if (teamIds.length === 0) return [];
    const members = await this.prisma.teamMember.findMany({
      where: { team_id: { in: teamIds }, status: 'active' },
      select: { user_id: true },
    });
    return members.map((m) => m.user_id);
  }

  async create(dto: CreateLeagueDto, user: UserPayload) {
    return this.prisma.tournament.create({
      data: {
        name: dto.name,
        description: dto.description,
        organizer_id: user.id,
        format: dto.format ?? 'round_robin',
        status: 'BROUILLON',
        max_teams: dto.max_teams,
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        location: dto.location,
        banner_url: dto.banner_url,
        prize_info: dto.prize_info,
        level: dto.level,
        registration_fee: dto.registration_fee ?? 0,
        matches_per_team: dto.matches_per_team ?? null,
        rules: dto.rules ?? null,
        rewards: dto.rewards ?? null,
      },
    });
  }

  async findAll(query: { status?: string; search?: string }) {
    return this.prisma.tournament.findMany({
      where: {
        AND: [
          query.status ? { status: query.status } : {},
          query.search
            ? { name: { contains: query.search, mode: 'insensitive' } }
            : {},
        ],
      },
      include: {
        _count: { select: { teams: true, matches: true } },
        organizer: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const league = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            team: {
              include: {
                _count: { select: { members: true } },
                home_terrain: { select: { id: true, name: true, city: true } },
              },
            },
          },
        },
        matches: {
          include: { home_team: true, away_team: true },
          orderBy: [{ round: 'asc' }, { scheduled_at: 'asc' }],
        },
        _count: { select: { teams: true, matches: true } },
        organizer: { select: { id: true, full_name: true } },
      },
    });
    if (!league) throw new NotFoundException('Ligue introuvable');
    return league;
  }

  async update(id: string, dto: UpdateLeagueDto) {
    const league = await this.prisma.tournament.findUnique({ where: { id } });
    if (!league) throw new NotFoundException('Ligue introuvable');
    if (league.status === 'ARCHIVÉE') throw new BadRequestException('Une ligue archivée ne peut pas être modifiée');

    return this.prisma.tournament.update({
      where: { id },
      data: {
        ...dto,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        updated_at: new Date(),
      },
    });
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    const league = await this.prisma.tournament.findUnique({ where: { id } });
    if (!league) throw new NotFoundException('Ligue introuvable');

    const allowed = STATUS_TRANSITIONS[league.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transition ${league.status} → ${dto.status} non autorisée`,
      );
    }

    if (dto.status === 'SUSPENDUE' && !dto.reason) {
      throw new BadRequestException('Une raison est requise pour suspendre une ligue');
    }

    const updated = await this.prisma.tournament.update({
      where: { id },
      data: { status: dto.status, updated_at: new Date() },
    });

    // Notifier les équipes inscrites lors des changements marquants.
    const notable: Record<string, { title: string; body: string }> = {
      INSCRIPTIONS_OUVERTES: { title: 'Inscriptions ouvertes', body: `Les inscriptions à ${league.name} sont ouvertes.` },
      EN_COURS: { title: 'La ligue démarre ⚽', body: `${league.name} a commencé. Bonne chance !` },
      TERMINÉE: { title: 'Ligue terminée', body: `${league.name} est terminée. Consulte le classement final.` },
    };
    const msg = notable[dto.status];
    if (msg) {
      const regs = await this.prisma.tournamentTeam.findMany({ where: { tournament_id: id }, select: { team_id: true } });
      const memberIds = await this.activeMemberIds(regs.map((r) => r.team_id));
      await this.notifications.notify(memberIds, {
        type: 'league_status',
        title: msg.title,
        body: msg.body,
        data: { league_id: id, status: dto.status },
      });
    }

    return updated;
  }

  async remove(id: string) {
    const league = await this.prisma.tournament.findUnique({ where: { id } });
    if (!league) throw new NotFoundException('Ligue introuvable');
    if (league.status !== 'BROUILLON') {
      throw new BadRequestException('Seule une ligue en brouillon peut être supprimée');
    }
    await this.prisma.tournament.delete({ where: { id } });
    return { message: 'Ligue supprimée' };
  }

  private isStaff(user: UserPayload) {
    return !['player', 'fan'].includes((user.role ?? '').toLowerCase());
  }

  /** L'inscription d'une équipe est réservée à son capitaine ou au staff. */
  private async assertRegistrationAuthority(teamId: string, user: UserPayload) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, home_terrain_id: true, coach_id: true },
    });
    if (!team) throw new NotFoundException('Équipe introuvable');
    if (this.isStaff(user) || team.coach_id === user.id) return team;
    const captain = await this.prisma.teamMember.findFirst({
      where: { team_id: teamId, user_id: user.id, role: 'captain', status: 'active' },
      select: { id: true },
    });
    if (!captain) throw new HttpException('Seul le capitaine peut inscrire son équipe.', HttpStatus.FORBIDDEN);
    return team;
  }

  /**
   * Etat de l'inscription pour le joueur connecté : utilisé par le mobile pour
   * ne jamais présenter un CTA "Inscrire" à une équipe déjà enregistrée.
   */
  async getMyRegistration(leagueId: string, user: UserPayload) {
    const league = await this.prisma.tournament.findUnique({
      where: { id: leagueId },
      select: { id: true, status: true, max_teams: true },
    });
    if (!league) throw new NotFoundException('Ligue introuvable');

    // Les équipes que le joueur est autorisé à inscrire (capitaine/créateur).
    // Elles ne suffisent pas à déterminer sa participation : un simple membre
    // doit également voir que SON équipe est déjà dans la ligue.
    const teams = await this.prisma.team.findMany({
      where: this.isStaff(user)
        ? {}
        : {
            OR: [
              { coach_id: user.id },
              { members: { some: { user_id: user.id, role: 'captain', status: 'active' } } },
            ],
          },
      select: { id: true, name: true, primary_color: true, home_terrain_id: true },
      orderBy: { created_at: 'asc' },
    });
    const teamIds = teams.map((team) => team.id);
    const [registrations, playerParticipation, memberParticipation, totalRegistered] = await Promise.all([
      teamIds.length
        ? this.prisma.tournamentTeam.findMany({
          where: { tournament_id: leagueId, team_id: { in: teamIds } },
          include: {
            team: { select: { id: true, name: true, primary_color: true } },
            league_payment: { select: { id: true, amount: true, status: true, transaction_id: true } },
          },
          orderBy: { registration_at: 'desc' },
        })
        : Promise.resolve([]),
      // Source de vérité persistante : ce verrou survit même si l'équipe est
      // modifiée après son inscription.
      this.isStaff(user)
        ? Promise.resolve(null)
        : this.prisma.leaguePlayerRegistration.findFirst({
            where: { tournament_id: leagueId, user_id: user.id },
            include: { team: { select: { id: true, name: true, primary_color: true } } },
            orderBy: { created_at: 'desc' },
          }),
      // Compatibilité des inscriptions historiques, antérieures au verrou.
      this.isStaff(user)
        ? Promise.resolve(null)
        : this.prisma.tournamentTeam.findFirst({
            where: {
              tournament_id: leagueId,
              OR: [
                { team: { coach_id: user.id } },
                { team: { members: { some: { user_id: user.id, status: 'active' } } } },
              ],
            },
            include: { team: { select: { id: true, name: true, primary_color: true } } },
            orderBy: { registration_at: 'desc' },
          }),
      this.prisma.tournamentTeam.count({ where: { tournament_id: leagueId } }),
    ]);
    const participation = playerParticipation ?? memberParticipation;
    return {
      teams,
      registrations,
      participation: participation
        ? { team: participation.team }
        : null,
      already_registered: registrations.length > 0 || participation !== null,
      registrations_open: league.status === 'INSCRIPTIONS_OUVERTES',
      league_full: totalRegistered >= league.max_teams,
    };
  }

  async registerTeam(leagueId: string, dto: RegisterTeamDto, user: UserPayload) {
    // Cette ancienne route est conservée pour compatibilité mais ne doit plus
    // créer d'inscription seule : le checkout crée paiement + inscription dans
    // une transaction atomique via POST /payments/leagues/:id/checkout.
    await this.assertRegistrationAuthority(dto.team_id, user);
    throw new HttpException(
      'Passe par le paiement de ligue pour confirmer l’inscription de ton équipe.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async getStandings(leagueId: string) {
    const league = await this.prisma.tournament.findUnique({
      where: { id: leagueId },
      include: {
        teams: { include: { team: { select: { id: true, name: true, logo_url: true, primary_color: true } } } },
        matches: { where: { status: 'VALIDÉ' } },
      },
    });
    if (!league) throw new NotFoundException('Ligue introuvable');

    const standings = league.teams.map(({ team }) => {
      const teamMatches = league.matches.filter(
        (m) => m.home_team_id === team.id || m.away_team_id === team.id,
      );

      let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

      for (const match of teamMatches) {
        const isHome = match.home_team_id === team.id;
        const teamScore = isHome ? match.home_score : match.away_score;
        const oppScore = isHome ? match.away_score : match.home_score;

        played++;
        gf += teamScore;
        ga += oppScore;
        if (teamScore > oppScore) won++;
        else if (teamScore === oppScore) drawn++;
        else lost++;
      }

      return {
        team,
        played,
        won,
        drawn,
        lost,
        goals_for: gf,
        goals_against: ga,
        goal_diff: gf - ga,
        points: won * 3 + drawn,
      };
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
      return b.goals_for - a.goals_for;
    });

    return standings.map((s, i) => ({ rank: i + 1, ...s }));
  }
}
