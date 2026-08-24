import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateTerrainDto } from './dto/create-terrain.dto';
import { CreateAdminTerrainDto } from './dto/create-admin-terrain.dto';
import { UpdateTerrainDto } from './dto/update-terrain.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { SetDayAvailabilityDto } from './dto/set-day-availability.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { PartnerAccessService } from '../partner-access/partner-access.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'OPERATEUR'];
function isAdmin(user: UserPayload): boolean {
  return ADMIN_ROLES.includes((user.role ?? '').toUpperCase());
}

@Injectable()
export class TerrainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerAccess: PartnerAccessService,
  ) {}

  /** Liste publique des terrains actifs (app mobile). */
  async findAll(query: { city?: string }) {
    const terrains = await this.prisma.terrain.findMany({
      where: {
        is_active: true,
        ...(query.city ? { city: query.city } : {}),
      },
      include: { _count: { select: { reservations: true, reviews: true } } },
      orderBy: { created_at: 'desc' },
    });
    return this.withRatings(terrains);
  }

  /** Vue complète destinée au BO (actifs + inactifs, propriétaire inclus). */
  async findAllAdmin() {
    const terrains = await this.prisma.terrain.findMany({
      include: {
        partner: { select: { id: true, full_name: true, username: true } },
        _count: { select: { reservations: true, reviews: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return this.withRatings(terrains);
  }

  /** Terrains détenus par le partenaire connecté (portail partenaire). */
  async findMine(user: UserPayload) {
    const partnerIds = await this.partnerAccess.accessiblePartnerIds(user);
    if (partnerIds.length === 0) return [];
    const terrains = await this.prisma.terrain.findMany({
      where: { partner_id: { in: partnerIds } },
      include: {
        slots: { orderBy: [{ day_of_week: 'asc' }, { start_hour: 'asc' }] },
        _count: { select: { reservations: true, reviews: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return this.withRatings(terrains);
  }

  async findOne(id: string) {
    const terrain = await this.prisma.withRetry(() =>
      this.prisma.terrain.findUnique({
        where: { id },
        include: {
          slots: { orderBy: [{ day_of_week: 'asc' }, { start_hour: 'asc' }] },
          blocks: { orderBy: { blocked_date: 'asc' } },
          partner: { select: { id: true, full_name: true } },
          _count: { select: { reservations: true, reviews: true } },
        },
      }),
    );
    if (!terrain) throw new NotFoundException('Terrain introuvable');
    const [withRating] = await this.withRatings([terrain]);
    return withRating;
  }

  /** Les favoris sont un choix volontaire du joueur, indépendant des réservations. */
  async findFavorites(user: UserPayload) {
    const favorites = await this.prisma.terrainFavorite.findMany({
      where: { user_id: user.id },
      include: {
        terrain: {
          include: { _count: { select: { reservations: true, reviews: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return this.withRatings(favorites.map((favorite) => favorite.terrain));
  }

  async addFavorite(terrainId: string, user: UserPayload) {
    const terrain = await this.prisma.terrain.findFirst({
      where: { id: terrainId, is_active: true },
      select: { id: true },
    });
    if (!terrain) throw new NotFoundException('Terrain introuvable');

    return this.prisma.terrainFavorite.upsert({
      where: { terrain_id_user_id: { terrain_id: terrainId, user_id: user.id } },
      create: { terrain_id: terrainId, user_id: user.id },
      update: {},
    });
  }

  async removeFavorite(terrainId: string, user: UserPayload) {
    await this.prisma.terrainFavorite.deleteMany({
      where: { terrain_id: terrainId, user_id: user.id },
    });
    return { ok: true };
  }

  /** Attache la note moyenne (rating_avg) et le nb d'avis (rating_count) aux terrains. */
  private async withRatings<T extends { id: string }>(terrains: T[]) {
    const ids = terrains.map((t) => t.id);
    if (ids.length === 0) return terrains;
    const rows = await this.prisma.withRetry(() =>
      this.prisma.terrainReview.groupBy({
        by: ['terrain_id'],
        where: { terrain_id: { in: ids } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    );
    const map = new Map(
      rows.map((r) => [
        r.terrain_id,
        {
          avg: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
          count: r._count.rating,
        },
      ]),
    );
    return terrains.map((t) => ({
      ...t,
      rating_avg: map.get(t.id)?.avg ?? 0,
      rating_count: map.get(t.id)?.count ?? 0,
    }));
  }

  /** Disponibilité d'un terrain pour une date : heures réservées/en attente/bloquées. */
  async getAvailability(id: string, date: string) {
    const day = new Date(date);
    const expand = (s: number, e: number) => {
      const out: number[] = [];
      for (let h = s; h < e; h += 0.5) out.push(Number(h.toFixed(1)));
      return out;
    };

    const pendingCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const [reservations, blocks] = await this.prisma.withRetry(() =>
      Promise.all([
        this.prisma.reservation.findMany({
          where: {
            terrain_id: id,
            reservation_date: day,
            OR: [
              { status: 'confirmed' },
              { status: 'pending', created_at: { gte: pendingCutoff } },
            ],
          },
          select: { start_hour: true, end_hour: true, status: true },
        }),
        this.prisma.terrainBlock.findMany({
          where: { terrain_id: id, blocked_date: day },
          select: { start_hour: true, end_hour: true },
        }),
      ]),
    );

    const booked = reservations
      .filter((r) => r.status === 'confirmed')
      .flatMap((r) => expand(r.start_hour, r.end_hour));
    const pending = reservations
      .filter((r) => r.status === 'pending')
      .flatMap((r) => expand(r.start_hour, r.end_hour));
    const blocked = blocks.flatMap((b) =>
      expand(b.start_hour ?? 6, b.end_hour ?? 22),
    );

    return { date, booked, pending, blocked };
  }

  // ─── Avis terrains ───────────────────────────────────────────────────────
  getReviews(terrainId: string) {
    return this.prisma.terrainReview.findMany({
      where: { terrain_id: terrainId },
      include: { user: { select: { id: true, full_name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Tous les avis (vue admin). */
  getAllReviews() {
    return this.prisma.terrainReview.findMany({
      include: {
        user: { select: { id: true, full_name: true } },
        terrain: { select: { id: true, name: true, city: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
  }

  /** Derniers avis des terrains accessibles depuis le portail partenaire. */
  async findReviewsForPartner(user: UserPayload) {
    const partnerIds = await this.partnerAccess.accessiblePartnerIds(user);
    if (partnerIds.length === 0) return [];
    return this.prisma.terrainReview.findMany({
      where: { terrain: { partner_id: { in: partnerIds } } },
      include: {
        user: { select: { id: true, full_name: true, avatar_url: true } },
        terrain: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });
  }

  /** Ajout/mise à jour d'un avis après la fin d'une réservation confirmée. */
  async addReview(terrainId: string, dto: CreateReviewDto, user: UserPayload) {
    const terrain = await this.prisma.terrain.findUnique({
      where: { id: terrainId },
    });
    if (!terrain) throw new NotFoundException('Terrain introuvable');

    const hasEndedReservation = await this.findEndedReservation(terrainId, user.id);
    if (!hasEndedReservation) {
      throw new ForbiddenException(
        "Un avis peut être laissé après la fin d'un créneau réservé et confirmé",
      );
    }

    return this.prisma.terrainReview.upsert({
      where: { terrain_id_user_id: { terrain_id: terrainId, user_id: user.id } },
      create: {
        terrain_id: terrainId,
        user_id: user.id,
        rating: dto.rating,
        comment: dto.comment,
      },
      update: { rating: dto.rating, comment: dto.comment },
    });
  }

  /** Dernier terrain terminé mais pas encore noté, pour le popup mobile. */
  async findPendingReview(user: UserPayload) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        user_id: user.id,
        status: { in: ['confirmed', 'completed'] },
      },
      include: { terrain: { select: { id: true, name: true, city: true } } },
      orderBy: [{ reservation_date: 'desc' }, { end_hour: 'desc' }],
      take: 30,
    });
    const ended = reservations.filter((reservation) =>
      this.hasEnded(reservation.reservation_date, reservation.end_hour),
    );
    if (ended.length === 0) return null;

    const reviewed = await this.prisma.terrainReview.findMany({
      where: {
        user_id: user.id,
        terrain_id: { in: ended.map((reservation) => reservation.terrain_id) },
      },
      select: { terrain_id: true },
    });
    const reviewedTerrainIds = new Set(reviewed.map((review) => review.terrain_id));
    return ended.find((reservation) => !reviewedTerrainIds.has(reservation.terrain_id)) ?? null;
  }

  private async findEndedReservation(terrainId: string, userId: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        terrain_id: terrainId,
        user_id: userId,
        status: { in: ['confirmed', 'completed'] },
      },
      select: { id: true, reservation_date: true, end_hour: true },
      orderBy: [{ reservation_date: 'desc' }, { end_hour: 'desc' }],
      take: 30,
    });
    return reservations.find((reservation) =>
      this.hasEnded(reservation.reservation_date, reservation.end_hour),
    );
  }

  private hasEnded(reservationDate: Date, endHour: number) {
    const end = new Date(reservationDate);
    end.setUTCHours(Math.floor(endHour), Math.round((endHour % 1) * 60), 0, 0);
    return end <= new Date();
  }

  create(dto: CreateTerrainDto, user: UserPayload) {
    return this.prisma.terrain.create({
      data: { ...dto, partner_id: user.id },
    });
  }

  async createForAdmin(dto: CreateAdminTerrainDto) {
    const partner = await this.prisma.profile.findUnique({
      where: { id: dto.partner_id },
      select: { id: true },
    });
    if (!partner) throw new NotFoundException('Partenaire introuvable');

    // `hours` n'est pas une colonne de Terrain : on l'extrait pour en dériver
    // les créneaux horaires (1 par heure entre start_hour et end_hour).
    const { hours, ...terrainData } = dto;
    const terrain = await this.prisma.terrain.create({ data: terrainData });

    if (hours && hours.length > 0) {
      const slots = hours.flatMap((day) => {
        const start = Math.max(0, Math.min(day.start_hour, day.end_hour));
        const end = Math.max(day.start_hour, day.end_hour);
        const rows: { terrain_id: string; day_of_week: number; start_hour: number; end_hour: number }[] = [];
        for (let h = start; h < end; h += 1) {
          rows.push({ terrain_id: terrain.id, day_of_week: day.day_of_week, start_hour: h, end_hour: h + 1 });
        }
        return rows;
      });
      if (slots.length > 0) {
        await this.prisma.terrainSlot.createMany({ data: slots, skipDuplicates: true });
      }
    }

    return terrain;
  }

  async update(id: string, dto: UpdateTerrainDto, user: UserPayload) {
    await this.assertOwner(id, user);
    return this.prisma.terrain.update({ where: { id }, data: dto });
  }

  // ─── Créneaux (disponibilités récurrentes) ───────────────────────────────
  getSlots(id: string) {
    return this.prisma.terrainSlot.findMany({
      where: { terrain_id: id },
      orderBy: [{ day_of_week: 'asc' }, { start_hour: 'asc' }],
    });
  }

  async addSlot(id: string, dto: CreateSlotDto, user: UserPayload) {
    await this.assertOwner(id, user);
    return this.prisma.terrainSlot.create({
      data: { terrain_id: id, ...dto },
    });
  }

  async removeSlot(id: string, slotId: string, user: UserPayload) {
    await this.assertOwner(id, user);
    // deleteMany (scopé au terrain) : idempotent, ne lève pas si introuvable.
    const { count } = await this.prisma.terrainSlot.deleteMany({
      where: { id: slotId, terrain_id: id },
    });
    return { ok: true, deleted: count };
  }

  /**
   * Ouvre ou ferme un jour de la semaine : bascule `is_active` sur TOUS les
   * créneaux récurrents de ce jour. Un jour fermé n'apparaît plus comme
   * disponible dans l'app mobile. Réservé au propriétaire/gérant du terrain.
   */
  async setDayAvailability(id: string, dto: SetDayAvailabilityDto, user: UserPayload) {
    await this.assertOwner(id, user);
    const { count } = await this.prisma.terrainSlot.updateMany({
      where: { terrain_id: id, day_of_week: dto.day_of_week },
      data: { is_active: dto.is_active },
    });
    // count === 0 : aucun créneau configuré ce jour-là (horaires à définir).
    return { ok: true, updated: count, is_active: dto.is_active };
  }

  // ─── Blocages (jours/heures fermés) ──────────────────────────────────────
  getBlocks(id: string) {
    return this.prisma.terrainBlock.findMany({
      where: { terrain_id: id },
      orderBy: { blocked_date: 'asc' },
    });
  }

  async addBlock(id: string, dto: CreateBlockDto, user: UserPayload) {
    await this.assertOwner(id, user);
    return this.prisma.terrainBlock.create({
      data: {
        terrain_id: id,
        blocked_date: new Date(dto.blocked_date),
        start_hour: dto.start_hour,
        end_hour: dto.end_hour,
        reason: dto.reason,
      },
    });
  }

  async removeBlock(id: string, blockId: string, user: UserPayload) {
    await this.assertOwner(id, user);
    // deleteMany (scopé au terrain) : idempotent, ne lève pas si introuvable.
    const { count } = await this.prisma.terrainBlock.deleteMany({
      where: { id: blockId, terrain_id: id },
    });
    return { ok: true, deleted: count };
  }

  private async assertOwner(id: string, user: UserPayload) {
    const terrain = await this.prisma.terrain.findUnique({ where: { id } });
    if (!terrain) throw new NotFoundException('Terrain introuvable');
    // Les admins du back-office peuvent gérer n'importe quel terrain.
    const hasPartnerAccess = await this.partnerAccess.canManagePartner(user, terrain.partner_id);
    if (!hasPartnerAccess && !isAdmin(user)) {
      throw new ForbiddenException('Accès refusé à ce terrain');
    }
    return terrain;
  }
}
