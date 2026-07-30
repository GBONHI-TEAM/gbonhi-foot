import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateTerrainDto } from './dto/create-terrain.dto';
import { UpdateTerrainDto } from './dto/update-terrain.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReviewDto } from './dto/create-review.dto';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONTRÔLEUR', 'OPÉRATEUR'];
function isAdmin(user: UserPayload): boolean {
  return ADMIN_ROLES.includes((user.role ?? '').toUpperCase());
}

@Injectable()
export class TerrainsService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** Terrains détenus par le partenaire connecté (portail partenaire). */
  async findMine(user: UserPayload) {
    const terrains = await this.prisma.terrain.findMany({
      where: { partner_id: user.id },
      include: {
        slots: { orderBy: [{ day_of_week: 'asc' }, { start_hour: 'asc' }] },
        _count: { select: { reservations: true, reviews: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return this.withRatings(terrains);
  }

  async findOne(id: string) {
    const terrain = await this.prisma.terrain.findUnique({
      where: { id },
      include: {
        slots: { orderBy: [{ day_of_week: 'asc' }, { start_hour: 'asc' }] },
        blocks: { orderBy: { blocked_date: 'asc' } },
        partner: { select: { id: true, full_name: true } },
        _count: { select: { reservations: true, reviews: true } },
      },
    });
    if (!terrain) throw new NotFoundException('Terrain introuvable');
    const [withRating] = await this.withRatings([terrain]);
    return withRating;
  }

  /** Attache la note moyenne (rating_avg) et le nb d'avis (rating_count) aux terrains. */
  private async withRatings<T extends { id: string }>(terrains: T[]) {
    const ids = terrains.map((t) => t.id);
    if (ids.length === 0) return terrains;
    const rows = await this.prisma.terrainReview.groupBy({
      by: ['terrain_id'],
      where: { terrain_id: { in: ids } },
      _avg: { rating: true },
      _count: { rating: true },
    });
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
      for (let h = s; h < e; h++) out.push(h);
      return out;
    };

    const reservations = await this.prisma.reservation.findMany({
      where: {
        terrain_id: id,
        reservation_date: day,
        status: { in: ['pending', 'confirmed'] },
      },
      select: { start_hour: true, end_hour: true, status: true },
    });
    const blocks = await this.prisma.terrainBlock.findMany({
      where: { terrain_id: id, blocked_date: day },
      select: { start_hour: true, end_hour: true },
    });

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

  /** Ajout/mise à jour d'un avis — réservé aux joueurs ayant réservé ce terrain. */
  async addReview(terrainId: string, dto: CreateReviewDto, user: UserPayload) {
    const terrain = await this.prisma.terrain.findUnique({
      where: { id: terrainId },
    });
    if (!terrain) throw new NotFoundException('Terrain introuvable');

    const hasReservation = await this.prisma.reservation.findFirst({
      where: { terrain_id: terrainId, user_id: user.id },
      select: { id: true },
    });
    if (!hasReservation) {
      throw new ForbiddenException(
        'Seuls les joueurs ayant réservé ce terrain peuvent laisser un avis',
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

  create(dto: CreateTerrainDto, user: UserPayload) {
    return this.prisma.terrain.create({
      data: { ...dto, partner_id: user.id },
    });
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
    if (terrain.partner_id !== user.id && !isAdmin(user)) {
      throw new ForbiddenException('Accès refusé à ce terrain');
    }
    return terrain;
  }
}
