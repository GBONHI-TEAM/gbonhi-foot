import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../auth/supabase.service';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserPayload } from '../../common/types/user-payload.type';
import { normalizeProfileRole, type AdminRole } from '../../common/access/roles';
import { AnalyticsService } from '../analytics/analytics.service';
import type { CreateAdminInvitationDto } from './dto/create-admin-invitation.dto';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly analytics: AnalyticsService,
  ) {}

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

  findAdminMembers() {
    return this.prisma.profile.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'SUPPORT', 'OPERATEUR'] } },
      select: { id: true, full_name: true, username: true, avatar_url: true, role: true, created_at: true, updated_at: true },
      orderBy: [{ role: 'asc' }, { created_at: 'asc' }],
    });
  }

  async inviteAdmin(dto: CreateAdminInvitationDto) {
    const email = dto.email.trim().toLowerCase();
    // Lien de retour après clic sur l'e-mail → page où l'on définit le mot de passe.
    const adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
    const redirectTo = `${adminUrl}/reset-password`;

    let authUser = await this.findAuthUserByEmail(email);
    // 'invited' = nouveau compte créé ; 'password_setup' = compte déjà existant
    // (ex. utilisateur mobile) à qui on envoie un lien pour définir un mot de passe BO.
    let mode: 'invited' | 'password_setup' = 'invited';

    if (!authUser) {
      const { data, error } = await this.supabase.client.auth.admin.inviteUserByEmail(email, {
        data: { full_name: dto.fullName.trim() },
        redirectTo,
      });
      if (error || !data.user) {
        throw new ServiceUnavailableException('Impossible d’envoyer l’invitation administrateur. Réessaie dans quelques instants.');
      }
      authUser = data.user;
      mode = 'invited';
    } else {
      // Le compte existe (souvent un utilisateur mobile créé par OTP, sans mot de
      // passe) : on lui envoie TOUJOURS un lien pour établir un mot de passe BO,
      // afin qu'il puisse se connecter au back-office même si l'e-mail existe déjà.
      const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        throw new ServiceUnavailableException('Impossible d’envoyer le lien d’accès. Réessaie dans quelques instants.');
      }
      mode = 'password_setup';
    }

    const profile = await this.prisma.profile.upsert({
      where: { id: authUser.id },
      create: { id: authUser.id, full_name: dto.fullName.trim(), username: dto.username?.trim() || null, role: dto.role },
      update: {
        full_name: dto.fullName.trim(),
        ...(dto.username?.trim() ? { username: dto.username.trim() } : {}),
        role: dto.role,
        updated_at: new Date(),
      },
      select: { id: true, full_name: true, username: true, role: true },
    });
    // invitationSent reste true dans les deux cas : un lien e-mail part toujours.
    return { ...profile, invitationSent: true, mode };
  }

  async upsertOnLogin(user: UserPayload) {
    const profile = await this.prisma.profile.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        full_name: null,
        role: 'player',
      },
      update: {},
    });
    await this.recordActivity(user, 'LOGIN');
    return profile;
  }

  /**
   * Résumé personnel du joueur connecté pour l'accueil mobile : ses équipes,
   * ses prochains matchs, ses ligues, ses stats et le nb de notifications non
   * lues. Tout est strictement rattaché au compte connecté.
   */
  async getSummary(user: UserPayload) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { user_id: user.id, status: 'active' },
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
        this.prisma.matchEvent.count({ where: { player_id: user.id, type: { in: ['BUT', 'PENALTY'] } } }),
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

  /**
   * Source unique de la fiche joueur dans le back-office.
   * Les données sportives détaillées sont conservées dans les métadonnées
   * Supabase du joueur (saisie mobile), tandis que l'identité et les stats
   * restent dans PostgreSQL. Le contrôleur lit donc la même fiche que le joueur.
   */
  async getPlayerCard(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        full_name: true,
        username: true,
        avatar_url: true,
        position: true,
        city: true,
        bio: true,
        player_public: true,
        player_share_slug: true,
      },
    });
    if (!profile) throw new NotFoundException('Joueur introuvable');

    // Club actuel (première équipe active) — affiché sur la carte.
    const membership = await this.prisma.teamMember.findFirst({
      where: { user_id: id, status: 'active' },
      select: { team: { select: { id: true, name: true, logo_url: true, primary_color: true } } },
      orderBy: { created_at: 'asc' },
    });

    const [goals, assists, yellowCards, redCards, memberships] = await Promise.all([
      this.prisma.matchEvent.count({ where: { player_id: id, type: { in: ['BUT', 'PENALTY'] } } }),
      this.prisma.matchEvent.count({ where: { player_id: id, type: 'PASSE' } }),
      this.prisma.matchEvent.count({ where: { player_id: id, type: 'CARTON_JAUNE' } }),
      this.prisma.matchEvent.count({ where: { player_id: id, type: 'CARTON_ROUGE' } }),
      this.prisma.teamMember.findMany({ where: { user_id: id, status: 'active' }, select: { team_id: true } }),
    ]);
    const teamIds = memberships.map((membership) => membership.team_id);
    const matchesPlayed = teamIds.length
      ? await this.prisma.match.count({
          where: {
            status: { in: ['TERMINÉ', 'VALIDÉ'] },
            OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
          },
        })
      : 0;

    let metadata: Record<string, unknown> = {};
    try {
      const { data, error } = await this.supabase.client.auth.admin.getUserById(id);
      if (!error && data.user?.user_metadata && typeof data.user.user_metadata === 'object') {
        metadata = data.user.user_metadata as Record<string, unknown>;
      }
    } catch {
      // La fiche BO reste disponible si le service Auth est temporairement indisponible.
    }
    const stringValue = (key: string) => typeof metadata[key] === 'string' ? metadata[key] : null;

    return {
      ...profile,
      current_team: membership?.team ?? null,
      player_profile: {
        birth_date: stringValue('birth_date'),
        height_cm: stringValue('height_cm'),
        weight_kg: stringValue('weight_kg'),
        preferred_foot: stringValue('preferred_foot'),
        secondary_position: stringValue('secondary_position'),
        level: stringValue('level'),
      },
      statistics: { matches_played: matchesPlayed, goals, assists, yellow_cards: yellowCards, red_cards: redCards },
    };
  }

  /** Génère un slug unique pour la carte publique (base : username ou nom). */
  private async generateUniqueSlug(base: string): Promise<string> {
    const root = (base || 'joueur')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      .slice(0, 24) || 'joueur';
    for (let i = 0; i < 12; i++) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const slug = `${root}-${suffix}`;
      const exists = await this.prisma.profile.findFirst({ where: { player_share_slug: slug }, select: { id: true } });
      if (!exists) return slug;
    }
    return `joueur-${Date.now().toString(36)}`;
  }

  /** Active/désactive la visibilité publique de la fiche joueur et fournit le
   *  lien de partage (généré à la première activation). */
  async setPlayerVisibility(userId: string, isPublic: boolean) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { player_share_slug: true, username: true, full_name: true },
    });
    if (!profile) throw new NotFoundException('Profil introuvable');

    let slug = profile.player_share_slug;
    if (isPublic && !slug) {
      slug = await this.generateUniqueSlug(profile.username || profile.full_name || 'joueur');
    }
    await this.prisma.profile.update({
      where: { id: userId },
      data: { player_public: isPublic, ...(slug ? { player_share_slug: slug } : {}) },
    });
    return { is_public: isPublic, slug, path: slug ? `/p/${slug}` : null };
  }

  /** Carte publique (lue via le slug de partage) — uniquement si publique. */
  async getPublicPlayerCard(slug: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { player_share_slug: slug, player_public: true },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Carte de joueur introuvable ou privée');
    return this.getPlayerCard(profile.id);
  }

  async updateMe(user: UserPayload, dto: UpdateUserDto) {
    if (dto.username) {
      const existing = await this.prisma.profile.findFirst({
        where: { username: dto.username, id: { not: user.id } },
      });
      if (existing) throw new ConflictException('Ce nom d\'utilisateur est déjà pris');
    }

    const profile = await this.prisma.profile.update({
      where: { id: user.id },
      data: {
        ...dto,
        updated_at: new Date(),
      },
    });
    if (dto.position) await this.recordActivity(user, 'PLAYER_PROFILE_COMPLETED', 'leagues');
    return profile;
  }

  private async recordActivity(
    user: UserPayload,
    type: 'LOGIN' | 'PLAYER_PROFILE_COMPLETED',
    mode?: 'leagues' | 'reservation',
  ) {
    try {
      await this.analytics.track(user, { type, mode });
    } catch {
      // La télémétrie ne doit jamais empêcher un utilisateur de se connecter
      // ou d'enregistrer son profil.
    }
  }

  private async findAuthUserByEmail(email: string): Promise<User | null> {
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await this.supabase.client.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new ServiceUnavailableException('La recherche du compte est temporairement indisponible.');
      const found = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (found) return found;
      if (data.users.length < 1000) break;
    }
    return null;
  }

  async updateRole(id: string, role: AdminRole, actor: UserPayload) {
    const target = await this.prisma.profile.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable');

    const targetRole = normalizeProfileRole(target.role);
    if (targetRole === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.profile.count({
        where: { role: 'SUPER_ADMIN' },
      });
      if (superAdminCount <= 1) {
        throw new ConflictException('Le dernier super administrateur ne peut pas perdre ses droits');
      }
    }

    if (actor.id === id && role !== 'SUPER_ADMIN') {
      throw new ConflictException('Vous ne pouvez pas retirer vos propres droits de super administrateur');
    }

    return this.prisma.profile.update({
      where: { id },
      data: { role, updated_at: new Date() },
      select: {
        id: true,
        full_name: true,
        role: true,
        updated_at: true,
      },
    });
  }

  /**
   * Suppression définitive d'un compte joueur. Les données sportives qui
   * doivent survivre (matchs) restent anonymisées ; les participations,
   * réservations, paiements et données communautaires du compte disparaissent.
   */
  async deleteMe(user: UserPayload) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, role: true },
    });
    if (!profile) throw new NotFoundException('Compte introuvable');

    // Tout compte peut demander sa suppression. Les responsabilités actives
    // (terrains, ligues, capitanat d'une équipe avec membres) doivent d'abord
    // être transférées — vérifié ci-dessous avec des messages explicites.

    const [terrainCount, organizedLeagueCount, coachedTeams] = await Promise.all([
      this.prisma.terrain.count({ where: { partner_id: user.id } }),
      this.prisma.tournament.count({ where: { organizer_id: user.id } }),
      this.prisma.team.findMany({
        where: { coach_id: user.id },
        select: { id: true, name: true },
      }),
    ]);
    if (terrainCount > 0 || organizedLeagueCount > 0) {
      throw new ConflictException('Transfère d’abord tes terrains ou tes ligues à un autre responsable avant de supprimer ton compte.');
    }

    const coachedTeamIds = coachedTeams.map((team) => team.id);
    if (coachedTeamIds.length > 0) {
      const otherMembers = await this.prisma.teamMember.findFirst({
        where: { team_id: { in: coachedTeamIds }, user_id: { not: user.id } },
        include: { team: { select: { name: true } } },
      });
      if (otherMembers) {
        throw new ConflictException(`Transfère d’abord le capitanat de ${otherMembers.team.name} : cette équipe possède encore des membres.`);
      }
    }

    // Vérifie le service d'identité avant toute mutation locale. Cela évite de
    // supprimer les données applicatives si Supabase Auth est indisponible.
    const authCheck = await this.supabase.client.auth.admin.getUserById(user.id);
    if (authCheck.error || !authCheck.data.user) {
      throw new ServiceUnavailableException('La suppression est temporairement indisponible. Réessaie dans quelques instants.');
    }

    const deletedTeamIds = await this.prisma.$transaction(async (tx) => {
      // La vérification est répétée dans la transaction afin de ne jamais
      // effacer une équipe qu'un autre joueur viendrait de rejoindre.
      const ownedTeams = await tx.team.findMany({
        where: { coach_id: user.id },
        select: { id: true },
      });
      const ownedIds = ownedTeams.map((team) => team.id);
      if (ownedIds.length > 0) {
        const concurrentMember = await tx.teamMember.findFirst({
          where: { team_id: { in: ownedIds }, user_id: { not: user.id } },
          select: { id: true },
        });
        if (concurrentMember) {
          throw new ConflictException('Une de tes équipes a reçu un nouveau membre. Transfère d’abord son capitanat.');
        }
      }

      const teamMatches = ownedIds.length
        ? await tx.match.findMany({
            where: { OR: [{ home_team_id: { in: ownedIds } }, { away_team_id: { in: ownedIds } }] },
            select: { home_team_id: true, away_team_id: true },
          })
        : [];
      const historicalTeamIds = new Set<string>();
      for (const match of teamMatches) {
        if (ownedIds.includes(match.home_team_id)) historicalTeamIds.add(match.home_team_id);
        if (ownedIds.includes(match.away_team_id)) historicalTeamIds.add(match.away_team_id);
      }
      const removableTeamIds = ownedIds.filter((teamId) => !historicalTeamIds.has(teamId));
      const anonymizedTeamIds = ownedIds.filter((teamId) => historicalTeamIds.has(teamId));

      // Un club présent dans l'historique d'un match reste comme trace sportive,
      // mais sans propriétaire, logo, code ou données de l'ancien compte.
      if (anonymizedTeamIds.length > 0) {
        await tx.team.updateMany({
          where: { id: { in: anonymizedTeamIds } },
          data: {
            name: 'Équipe supprimée',
            description: null,
            logo_url: null,
            coach_id: null,
            invitation_code: null,
            status: 'deleted',
          },
        });
      }

      // Paiements avant réservations : les deux relations sont restrictives.
      await tx.payment.deleteMany({ where: { user_id: user.id } });
      await tx.reservation.deleteMany({ where: { user_id: user.id } });
      await tx.leagueRegistrationPayment.deleteMany({ where: { user_id: user.id } });

      // Les historiques de match sont gardés mais ne pointent plus vers la
      // personne supprimée.
      await tx.matchEvent.updateMany({ where: { player_id: user.id }, data: { player_id: null } });
      await tx.match.updateMany({ where: { referee_id: user.id }, data: { referee_id: null } });

      if (removableTeamIds.length > 0) {
        await tx.team.deleteMany({ where: { id: { in: removableTeamIds } } });
      }

      await tx.leaguePlayerRegistration.deleteMany({ where: { user_id: user.id } });
      await tx.teamMember.deleteMany({ where: { user_id: user.id } });
      await tx.profile.delete({ where: { id: user.id } });
      return removableTeamIds;
    });

    const authDeletion = await this.supabase.client.auth.admin.deleteUser(user.id);
    if (authDeletion.error) {
      throw new ServiceUnavailableException('Les données ont été retirées mais la fermeture Auth a échoué. Contacte le support pour finaliser la déconnexion.');
    }

    await this.removeStorageFolder('avatars', user.id);
    await Promise.all(deletedTeamIds.map((teamId) => this.removeStorageFolder('teams', teamId)));
    return { deleted: true };
  }

  private async removeStorageFolder(bucket: string, folder: string) {
    try {
      const { data, error } = await this.supabase.client.storage.from(bucket).list(folder, { limit: 100 });
      if (error || !data?.length) return;
      await this.supabase.client.storage.from(bucket).remove(data.map((item) => `${folder}/${item.name}`));
    } catch {
      // Le compte est déjà supprimé ; un nettoyage Storage peut être repris sans
      // incidence ultérieure et ne doit pas empêcher le droit à l'effacement.
    }
  }
}
