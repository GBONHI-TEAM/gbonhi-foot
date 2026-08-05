import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import type { UserPayload } from '../../common/types/user-payload.type';
import { SupabaseService } from '../auth/supabase.service';
import type { CreatePartnerAccessDto } from './dto/create-partner-access.dto';
import type { CreatePartnerManagerDto } from './dto/create-partner-manager.dto';

const ACCESS_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED'] as const;
type AccessStatus = (typeof ACCESS_STATUSES)[number];

@Injectable()
export class PartnerAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async findAll() {
    const accesses = await this.prisma.partnerAccess.findMany({
      include: {
        partner: { select: { id: true, full_name: true, username: true } },
        user: { select: { id: true, full_name: true, username: true, avatar_url: true } },
      },
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    });

    const partnerIds = Array.from(new Set(accesses.map((access) => access.partner_id)));
    const terrainCounts = partnerIds.length === 0
      ? []
      : await this.prisma.terrain.groupBy({ by: ['partner_id'], where: { partner_id: { in: partnerIds } }, _count: { _all: true } });
    const terrainCountByPartner = new Map(terrainCounts.map((row) => [row.partner_id, row._count._all]));

    return accesses.map((access) => ({
      ...access,
      terrainCount: terrainCountByPartner.get(access.partner_id) ?? 0,
    }));
  }

  async findPartners() {
    const partners = await this.prisma.profile.findMany({
      where: {
        OR: [
          { terrains: { some: {} } },
          { partner_accesses: { some: { role: 'OWNER', status: { in: ['INVITED', 'ACTIVE'] } } } },
          { role: { in: ['partner', 'PARTNER'] } },
        ],
      },
      select: {
        id: true,
        full_name: true,
        username: true,
        terrains: { select: { id: true, name: true } },
      },
      orderBy: { full_name: 'asc' },
    });
    return partners.map((partner) => ({
      id: partner.id,
      name: partner.full_name?.trim() || partner.username?.trim() || 'Partenaire sans nom',
      terrains: partner.terrains,
    }));
  }

  async findMineAndTouch(user: UserPayload) {
    const access = await this.prisma.partnerAccess.findFirst({
      where: { user_id: user.id, status: { in: ['INVITED', 'ACTIVE'] } },
      include: { partner: { select: { id: true, full_name: true, username: true } } },
      orderBy: { role: 'asc' },
    });
    if (!access) throw new NotFoundException('Aucun accès partenaire actif pour ce compte');

    return this.prisma.partnerAccess.update({
      where: { id: access.id },
      // Le lien d'invitation Supabase n'est utilisable qu'après validation du
      // compte. À sa première ouverture du portail, l'invité devient actif.
      data: {
        status: 'ACTIVE',
        accepted_at: access.accepted_at ?? new Date(),
        last_login_at: new Date(),
        updated_at: new Date(),
      },
      include: { partner: { select: { id: true, full_name: true, username: true } } },
    });
  }

  /** Membres du ou des partenaires dont l'utilisateur est réellement propriétaire. */
  async findOwnedTeam(user: UserPayload) {
    const partnerIds = await this.ownerPartnerIds(user);
    if (partnerIds.length === 0) {
      throw new ForbiddenException('La gestion des accès est réservée au propriétaire du partenaire');
    }
    return this.prisma.partnerAccess.findMany({
      where: { partner_id: { in: partnerIds }, status: { not: 'REVOKED' } },
      include: {
        partner: { select: { id: true, full_name: true, username: true } },
        user: { select: { id: true, full_name: true, username: true, avatar_url: true } },
      },
      orderBy: [{ partner_id: 'asc' }, { role: 'asc' }, { created_at: 'asc' }],
    });
  }

  async createManagerForOwner(dto: CreatePartnerManagerDto, owner: UserPayload) {
    const partnerId = await this.singleOwnedPartnerId(owner);
    return this.create({ ...dto, partnerId, role: 'MANAGER' }, owner);
  }

  async updateManagerStatusForOwner(id: string, status: 'ACTIVE' | 'SUSPENDED', owner: UserPayload) {
    await this.assertOwnerManagesAccess(id, owner);
    return this.updateStatus(id, status);
  }

  async revokeManagerForOwner(id: string, owner: UserPayload) {
    await this.assertOwnerManagesAccess(id, owner);
    return this.revoke(id);
  }

  /** Identifiants des propriétaires dont le compte peut gérer les terrains. */
  async accessiblePartnerIds(user: UserPayload): Promise<string[]> {
    const accesses = await this.activeAccesses(user);
    return Array.from(new Set(accesses.map((access) => access.partner_id)));
  }

  async ownerPartnerIds(user: UserPayload): Promise<string[]> {
    const accesses = await this.activeAccesses(user);
    return Array.from(new Set(accesses.filter((access) => access.role === 'OWNER').map((access) => access.partner_id)));
  }

  async roleByPartner(user: UserPayload): Promise<Map<string, 'OWNER' | 'MANAGER'>> {
    const accesses = await this.activeAccesses(user);
    return new Map(accesses.map((access) => [access.partner_id, access.role as 'OWNER' | 'MANAGER']));
  }

  async canManagePartner(user: UserPayload, partnerId: string): Promise<boolean> {
    const access = await this.prisma.partnerAccess.findFirst({
      where: { user_id: user.id, partner_id: partnerId, status: 'ACTIVE' },
      select: { id: true },
    });
    return Boolean(access);
  }

  private activeAccesses(user: UserPayload) {
    return this.prisma.partnerAccess.findMany({
      where: { user_id: user.id, status: 'ACTIVE' },
      select: { partner_id: true, role: true },
    });
  }

  async create(dto: CreatePartnerAccessDto, actor: UserPayload) {
    const partner = await this.prisma.profile.findUnique({
      where: { id: dto.partnerId },
      select: { id: true },
    });
    if (!partner) throw new NotFoundException('Partenaire introuvable');

    const email = dto.email.trim().toLowerCase();
    let authUser = await this.findAuthUserByEmail(email);
    let invitationSent = false;

    if (!authUser) {
      const { data, error } = await this.supabase.client.auth.admin.inviteUserByEmail(email, {
        data: { full_name: dto.fullName.trim() },
      });
      if (error || !data.user) {
        throw new ServiceUnavailableException('Impossible d’envoyer l’invitation partenaire. Réessaie dans quelques instants.');
      }
      authUser = data.user;
      invitationSent = true;
    }

    await this.prisma.profile.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        full_name: dto.fullName.trim(),
        username: dto.username?.trim() || null,
        role: 'partner',
      },
      update: {
        full_name: dto.fullName.trim(),
        ...(dto.username?.trim() ? { username: dto.username.trim() } : {}),
        updated_at: new Date(),
      },
    });

    const existing = await this.prisma.partnerAccess.findUnique({
      where: { partner_id_user_id: { partner_id: dto.partnerId, user_id: authUser.id } },
      select: { id: true, status: true },
    });
    if (existing?.status === 'ACTIVE') {
      throw new ConflictException('Cette personne possède déjà un accès actif à ce partenaire');
    }

    const now = new Date();
    const status: AccessStatus = invitationSent ? 'INVITED' : 'ACTIVE';
    const access = await this.prisma.partnerAccess.upsert({
      where: { partner_id_user_id: { partner_id: dto.partnerId, user_id: authUser.id } },
      create: {
        partner_id: dto.partnerId,
        user_id: authUser.id,
        email,
        role: dto.role,
        status,
        invited_by_id: actor.id,
        invited_at: now,
        accepted_at: invitationSent ? null : now,
      },
      update: {
        email,
        role: dto.role,
        status,
        invited_by_id: actor.id,
        invited_at: now,
        accepted_at: invitationSent ? null : now,
        suspended_at: null,
        revoked_at: null,
        updated_at: now,
      },
      include: { partner: { select: { id: true, full_name: true, username: true } }, user: { select: { id: true, full_name: true, username: true } } },
    });

    return { ...access, invitationSent };
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    const access = await this.getAccess(id);
    if (access.role === 'OWNER' && status === 'SUSPENDED') {
      throw new ConflictException('Le propriétaire ne peut pas être suspendu ici. Transfère d’abord la propriété du partenaire.');
    }
    const now = new Date();
    return this.prisma.partnerAccess.update({
      where: { id },
      data: {
        status,
        accepted_at: status === 'ACTIVE' ? now : access.accepted_at,
        suspended_at: status === 'SUSPENDED' ? now : null,
        revoked_at: null,
        updated_at: now,
      },
    });
  }

  async revoke(id: string) {
    const access = await this.getAccess(id);
    if (access.role === 'OWNER') {
      throw new ConflictException('Le propriétaire ne peut pas être révoqué. Transfère d’abord la propriété du partenaire.');
    }
    const now = new Date();
    return this.prisma.partnerAccess.update({
      where: { id },
      data: { status: 'REVOKED', revoked_at: now, updated_at: now },
    });
  }

  private async singleOwnedPartnerId(owner: UserPayload): Promise<string> {
    const partnerIds = await this.ownerPartnerIds(owner);
    if (partnerIds.length === 0) {
      throw new ForbiddenException('La gestion des accès est réservée au propriétaire du partenaire');
    }
    if (partnerIds.length > 1) {
      throw new ConflictException('Ce compte possède plusieurs partenaires. La gestion doit être effectuée depuis le back-office.');
    }
    return partnerIds[0];
  }

  private async assertOwnerManagesAccess(id: string, owner: UserPayload) {
    const access = await this.getAccess(id);
    const partnerIds = await this.ownerPartnerIds(owner);
    if (!partnerIds.includes(access.partner_id) || access.role !== 'MANAGER') {
      throw new ForbiddenException('Vous ne pouvez gérer que les gérants de votre partenaire');
    }
    return access;
  }

  private async getAccess(id: string) {
    const access = await this.prisma.partnerAccess.findUnique({ where: { id } });
    if (!access) throw new NotFoundException('Accès partenaire introuvable');
    return access;
  }

  private async findAuthUserByEmail(email: string): Promise<User | null> {
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await this.supabase.client.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new ServiceUnavailableException('La recherche du compte partenaire est temporairement indisponible.');
      const found = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (found) return found;
      if (data.users.length < 1000) break;
    }
    return null;
  }
}
