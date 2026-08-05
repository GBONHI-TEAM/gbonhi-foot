import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ChangeReservationStatusDto } from './dto/change-status.dto';
import { PartnerAccessService } from '../partner-access/partner-access.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { createPartnerRevenueStatementPdf } from '../payments/receipt-pdf';

const PLATFORM_FEE_RATE = 0.1; // 10 % commission plateforme
const CART_HOLD_MINUTES = 15;
const CART_CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class ReservationsService {
  private readonly lastCartCleanupByUser = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerAccess: PartnerAccessService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Réservations des terrains du partenaire connecté. */
  async findForPartner(
    user: UserPayload,
    query: { date?: string; status?: string; terrain_id?: string; from?: string; to?: string },
  ) {
    const ids = await this.partnerTerrainIds(user);
    if (ids.length === 0) return [];
    const roleByPartner = await this.partnerAccess.roleByPartner(user);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        terrain_id:
          query.terrain_id && ids.includes(query.terrain_id)
            ? query.terrain_id
            : { in: ids },
        ...(query.status ? { status: query.status } : {}),
        ...(query.date ? { reservation_date: new Date(query.date) } : { reservation_date: this.period(query.from, query.to) }),
      },
      include: {
        terrain: { select: { id: true, name: true, city: true, partner_id: true } },
        user: { select: { id: true, full_name: true, avatar_url: true } },
        payment: {
          select: { status: true, payment_method: true, amount: true },
        },
      },
      orderBy: [{ reservation_date: 'desc' }, { start_hour: 'asc' }],
    });
    // Un gérant peut piloter l'opérationnel, mais ne reçoit jamais les montants
    // ou détails de paiement des terrains dont il n'est pas propriétaire.
    return reservations.map((reservation) => {
      const role = roleByPartner.get(reservation.terrain.partner_id);
      if (role === 'OWNER') return reservation;
      const { unit_price, total_price, platform_fee, partner_amount, payment, ...operationalReservation } = reservation;
      void unit_price;
      void total_price;
      void platform_fee;
      void partner_amount;
      void payment;
      return operationalReservation;
    });
  }

  /** Vue globale des réservations (admin BO). */
  findAllAdmin(query: { date?: string; status?: string; from?: string; to?: string }) {
    return this.prisma.reservation.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.date ? { reservation_date: new Date(query.date) } : { reservation_date: this.period(query.from, query.to) }),
      },
      include: {
        terrain: {
          select: {
            id: true,
            name: true,
            city: true,
            partner: { select: { full_name: true } },
          },
        },
        user: { select: { id: true, full_name: true, avatar_url: true } },
        payment: { select: { status: true, payment_method: true, amount: true } },
      },
      orderBy: [{ reservation_date: 'desc' }, { start_hour: 'asc' }],
    });
  }

  /** Réservations du joueur connecté (accueil mobile). */
  async findMine(user: UserPayload) {
    await this.releaseExpiredPendingReservations(user.id);
    return this.prisma.reservation.findMany({
      where: { user_id: user.id },
      orderBy: [{ reservation_date: 'desc' }, { start_hour: 'desc' }],
      include: { terrain: { select: { id: true, name: true, city: true, surface: true } } },
      take: 50,
    });
  }

  /** Une seule réservation peut attendre son paiement dans le panier. */
  async findPendingMine(user: UserPayload) {
    await this.releaseExpiredPendingReservations(user.id);
    return this.prisma.reservation.findFirst({
      where: { user_id: user.id, status: 'pending' },
      include: {
        terrain: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            surface: true,
            photos: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { terrain: true, user: true, payment: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    return reservation;
  }

  /** Détail mobile : le joueur connecté ne peut consulter que sa réservation. */
  async findMineOne(id: string, user: UserPayload) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, user_id: user.id },
      include: { terrain: true, payment: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    return reservation;
  }

  /** Création d'une réservation (côté joueur / app mobile). */
  async create(dto: CreateReservationDto, user: UserPayload) {
    await this.releaseExpiredPendingReservations(user.id, true);
    const existingCart = await this.prisma.reservation.findFirst({
      where: { user_id: user.id, status: 'pending' },
      select: { id: true },
    });
    if (existingCart) {
      throw new ConflictException(
        'Tu as déjà une réservation en attente. Finalise-la ou annule-la dans ton panier.',
      );
    }

    const terrain = await this.prisma.terrain.findUnique({
      where: { id: dto.terrain_id },
    });
    if (!terrain) throw new NotFoundException('Terrain introuvable');

    const duration = dto.end_hour - dto.start_hour;
    const isHalfHourIncrement = (value: number) => Math.abs(value * 2 - Math.round(value * 2)) < Number.EPSILON;
    if (!isHalfHourIncrement(dto.start_hour) || !isHalfHourIncrement(dto.end_hour) || duration < 0.5) {
      throw new BadRequestException('Le créneau doit être défini par tranches de 30 minutes minimum.');
    }

    const reservationDate = new Date(`${dto.reservation_date}T00:00:00.000Z`);
    const conflictingReservation = await this.prisma.reservation.findFirst({
      where: {
        terrain_id: dto.terrain_id,
        reservation_date: reservationDate,
        status: { in: ['pending', 'confirmed'] },
        start_hour: { lt: dto.end_hour },
        end_hour: { gt: dto.start_hour },
      },
      select: { id: true },
    });
    if (conflictingReservation) {
      throw new ConflictException('Ce créneau vient d’être réservé. Choisis un autre horaire.');
    }

    const conflictingBlock = await this.prisma.terrainBlock.findFirst({
      where: {
        terrain_id: dto.terrain_id,
        blocked_date: reservationDate,
        OR: [
          { start_hour: null },
          {
            AND: [
              { start_hour: { lt: dto.end_hour } },
              { end_hour: { gt: dto.start_hour } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    if (conflictingBlock) {
      throw new ConflictException('Ce créneau est indisponible.');
    }

    const unit = terrain.price_per_hour;
    const total = Math.round(unit * duration);
    const fee = Math.round(total * PLATFORM_FEE_RATE);

    const reservation = await this.prisma.reservation.create({
      data: {
        terrain_id: dto.terrain_id,
        user_id: user.id,
        reservation_date: reservationDate,
        start_hour: dto.start_hour,
        end_hour: dto.end_hour,
        unit_price: unit,
        total_price: total,
        platform_fee: fee,
        partner_amount: total - fee,
        status: 'pending',
        notes: dto.notes,
      },
    });
    try {
      await this.analytics.track(user, { type: 'RESERVATION_CREATED', mode: 'reservation' });
    } catch {
      // Une réservation ne dépend jamais de la disponibilité du KPI.
    }
    return reservation;
  }

  /** Annulation volontaire d'une réservation qui n'a pas encore été payée. */
  async cancelMinePending(id: string, user: UserPayload) {
    const result = await this.prisma.reservation.updateMany({
      where: { id, user_id: user.id, status: 'pending' },
      data: { status: 'cancelled', cancel_reason: 'Annulée par le joueur avant paiement' },
    });
    if (result.count === 0) {
      throw new NotFoundException('Cette réservation en attente est introuvable.');
    }
    return { ok: true };
  }

  /**
   * Libère les créneaux non payés après 15 minutes. Les réservations confirmées
   * ne sont jamais concernées. Cette méthode est appelée avant chaque action
   * du panier afin d'éviter qu'un créneau abandonné reste bloqué indéfiniment.
   */
  async releaseExpiredPendingReservations(userId?: string, force = false) {
    // Une consultation de profil ne doit pas déclencher une écriture SQL à
    // chaque affichage. Un même panier est vérifié au plus une fois par minute
    // côté instance ; l'expiration reste aussi contrôlée lors de sa création et
    // de son paiement.
    if (userId) {
      const now = Date.now();
      const lastCleanup = this.lastCartCleanupByUser.get(userId) ?? 0;
      if (!force && now - lastCleanup < CART_CLEANUP_INTERVAL_MS) return { count: 0 };
      this.lastCartCleanupByUser.set(userId, now);
    }
    const cutoff = new Date(Date.now() - CART_HOLD_MINUTES * 60 * 1000);
    return this.prisma.reservation.updateMany({
      where: {
        status: 'pending',
        created_at: { lt: cutoff },
        ...(userId ? { user_id: userId } : {}),
      },
      data: {
        status: 'cancelled',
        cancel_reason: 'Délai de validation du panier expiré',
      },
    });
  }

  /** Confirmation / annulation par le partenaire propriétaire du terrain. */
  async updateStatus(
    id: string,
    dto: ChangeReservationStatusDto,
    user: UserPayload,
  ) {
    await this.assertPartnerOwns(id, user);
    return this.prisma.reservation.update({
      where: { id },
      data: { status: dto.status, cancel_reason: dto.cancel_reason },
    });
  }

  /** KPI du tableau de bord partenaire. */
  async summary(user: UserPayload, from?: string, to?: string) {
    const ids = await this.ownerTerrainIds(user);
    if (ids.length === 0) {
      throw new ForbiddenException('Les données financières sont réservées au propriétaire du partenaire');
    }
    const empty = {
      today_count: 0,
      today_revenue: 0,
      week_revenue: 0,
      month_revenue: 0,
      occupancy_rate: 0,
      total_reservations: 0,
    };
    if (ids.length === 0) return empty;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7)); // lundi

    const selectedPeriod = this.period(from, to);
    const reservations = await this.prisma.reservation.findMany({
      where: { terrain_id: { in: ids }, reservation_date: selectedPeriod },
      select: {
        reservation_date: true,
        start_hour: true,
        end_hour: true,
        duration_hours: true,
        partner_amount: true,
        status: true,
      },
    });

    const paid = reservations.filter(
      (r) => r.status === 'confirmed' || r.status === 'completed',
    );
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const todayList = paid.filter((r) => sameDay(new Date(r.reservation_date), now));
    const today_revenue = todayList.reduce((s, r) => s + r.partner_amount, 0);
    const week_revenue = paid
      .filter((r) => new Date(r.reservation_date) >= startOfWeek)
      .reduce((s, r) => s + r.partner_amount, 0);
    const month_revenue = paid
      .filter((r) => new Date(r.reservation_date) >= startOfMonth)
      .reduce((s, r) => s + r.partner_amount, 0);

    // Lorsqu'une période explicite est demandée par le portail, les quatre
    // indicateurs financiers deviennent les totaux de cette période, plutôt
    // que des valeurs relatives à la semaine/mois courant.
    const selectedRevenue = paid.reduce((sum, reservation) => sum + reservation.partner_amount, 0);

    // Taux d'occupation du jour = heures réservées / heures ouvrables (12h/terrain)
    const bookedHoursToday = reservations
      .filter((r) => sameDay(new Date(r.reservation_date), now))
      .reduce((s, r) => s + r.duration_hours, 0);
    const openHours = ids.length * 12;
    const occupancy_rate = openHours
      ? Math.round((bookedHoursToday / openHours) * 100)
      : 0;

    return {
      today_count: from || to ? reservations.length : reservations.filter((r) =>
        sameDay(new Date(r.reservation_date), now),
      ).length,
      today_revenue: from || to ? selectedRevenue : today_revenue,
      week_revenue: from || to ? selectedRevenue : week_revenue,
      month_revenue: from || to ? selectedRevenue : month_revenue,
      occupancy_rate,
      total_reservations: reservations.length,
    };
  }

  /** Données sans aucun montant, accessibles aux propriétaires et gérants. */
  async operationalSummary(user: UserPayload) {
    const ids = await this.partnerTerrainIds(user);
    if (ids.length === 0) return { today_count: 0, occupancy_rate: 0, total_reservations: 0 };

    const now = new Date();
    const reservations = await this.prisma.reservation.findMany({
      where: { terrain_id: { in: ids } },
      select: { reservation_date: true, duration_hours: true },
    });
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const today = reservations.filter((reservation) => sameDay(new Date(reservation.reservation_date), now));
    const bookedHoursToday = today.reduce((sum, reservation) => sum + reservation.duration_hours, 0);
    const openHours = ids.length * 12;
    return {
      today_count: today.length,
      occupancy_rate: openHours ? Math.round((bookedHoursToday / openHours) * 100) : 0,
      total_reservations: reservations.length,
    };
  }

  /** Courbe quotidienne des montants nets reversables : strictement propriétaire. */
  async revenueHistory(user: UserPayload, from?: string, to?: string) {
    const ids = await this.ownerTerrainIds(user);
    if (ids.length === 0) {
      throw new ForbiddenException('Les données financières sont réservées au propriétaire du partenaire');
    }
    const defaultEnd = new Date();
    defaultEnd.setHours(23, 59, 59, 999);
    const defaultStart = new Date(defaultEnd);
    defaultStart.setDate(defaultStart.getDate() - 29);
    defaultStart.setHours(0, 0, 0, 0);
    const selectedPeriod = this.period(from, to);
    const start = selectedPeriod.gte ?? defaultStart;
    const end = selectedPeriod.lte ?? defaultEnd;
    const reservations = await this.prisma.reservation.findMany({
      where: {
        terrain_id: { in: ids },
        reservation_date: { gte: start, lte: end },
        status: { in: ['confirmed', 'completed'] },
      },
      select: { reservation_date: true, partner_amount: true },
    });
    const totals = new Map<string, number>();
    for (let index = 0; index < 30; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      totals.set(date.toISOString().slice(0, 10), 0);
    }
    for (const reservation of reservations) {
      const key = reservation.reservation_date.toISOString().slice(0, 10);
      totals.set(key, (totals.get(key) ?? 0) + reservation.partner_amount);
    }
    return [...totals.entries()].map(([date, amount]) => ({ date, amount }));
  }

  async revenueStatement(user: UserPayload, from?: string, to?: string): Promise<Buffer> {
    const ids = await this.ownerTerrainIds(user);
    if (ids.length === 0) {
      throw new ForbiddenException('Les données financières sont réservées au propriétaire du partenaire');
    }
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const selectedPeriod = this.period(from, to);
    const start = selectedPeriod.gte ?? defaultStart;
    const end = selectedPeriod.lte ?? now;
    const [partner, reservations] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: user.id }, select: { full_name: true, username: true } }),
      this.prisma.reservation.findMany({
        where: { terrain_id: { in: ids }, reservation_date: { gte: start, lte: end }, status: { in: ['confirmed', 'completed'] } },
        include: { terrain: { select: { name: true } } },
        orderBy: [{ reservation_date: 'desc' }, { start_hour: 'desc' }],
      }),
    ]);
    const period = start.toLocaleDateString('fr-FR') === end.toLocaleDateString('fr-FR')
      ? start.toLocaleDateString('fr-FR')
      : `${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;
    const amount = reservations.reduce((sum, reservation) => sum + reservation.partner_amount, 0);
    return createPartnerRevenueStatementPdf({
      reference: `PART-${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}-${user.id.slice(0, 8).toUpperCase()}`,
      partnerName: partner?.full_name?.trim() || partner?.username?.trim() || 'Partenaire GBONHI FOOT',
      period: period.charAt(0).toUpperCase() + period.slice(1),
      totalNet: `${amount.toLocaleString('fr-FR')} FCFA`,
      reservationCount: reservations.length,
      lines: reservations.map((reservation) => ({
        date: reservation.reservation_date.toLocaleDateString('fr-FR'),
        terrain: reservation.terrain.name,
        amount: `${reservation.partner_amount.toLocaleString('fr-FR')} FCFA`,
      })),
    });
  }

  private async partnerTerrainIds(user: UserPayload): Promise<string[]> {
    const partnerIds = await this.partnerAccess.accessiblePartnerIds(user);
    if (partnerIds.length === 0) return [];
    const terrains = await this.prisma.terrain.findMany({
      where: { partner_id: { in: partnerIds } },
      select: { id: true },
    });
    return terrains.map((t) => t.id);
  }

  private async ownerTerrainIds(user: UserPayload): Promise<string[]> {
    const partnerIds = await this.partnerAccess.ownerPartnerIds(user);
    if (partnerIds.length === 0) return [];
    const terrains = await this.prisma.terrain.findMany({
      where: { partner_id: { in: partnerIds } },
      select: { id: true },
    });
    return terrains.map((terrain) => terrain.id);
  }

  private period(from?: string, to?: string): { gte?: Date; lte?: Date } {
    const start = this.parseDate(from);
    const end = this.parseDate(to);
    if (from && !start) throw new BadRequestException('La date de début est invalide');
    if (to && !end) throw new BadRequestException('La date de fin est invalide');
    if (start && end && start > end) throw new BadRequestException('La période sélectionnée est invalide');
    if (end) end.setHours(23, 59, 59, 999);
    return { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
  }

  private parseDate(value?: string): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async assertPartnerOwns(id: string, user: UserPayload) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { terrain: { select: { partner_id: true } } },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    const hasPartnerAccess = await this.partnerAccess.canManagePartner(user, reservation.terrain.partner_id);
    if (!hasPartnerAccess) {
      throw new ForbiddenException('Accès refusé à cette réservation');
    }
    return reservation;
  }
}
