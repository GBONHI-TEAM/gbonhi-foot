import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ChangeReservationStatusDto } from './dto/change-status.dto';

const PLATFORM_FEE_RATE = 0.1; // 10 % commission plateforme

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Réservations des terrains du partenaire connecté. */
  async findForPartner(
    user: UserPayload,
    query: { date?: string; status?: string; terrain_id?: string },
  ) {
    const ids = await this.partnerTerrainIds(user);
    if (ids.length === 0) return [];

    return this.prisma.reservation.findMany({
      where: {
        terrain_id:
          query.terrain_id && ids.includes(query.terrain_id)
            ? query.terrain_id
            : { in: ids },
        ...(query.status ? { status: query.status } : {}),
        ...(query.date ? { reservation_date: new Date(query.date) } : {}),
      },
      include: {
        terrain: { select: { id: true, name: true, city: true } },
        user: { select: { id: true, full_name: true, avatar_url: true } },
        payment: {
          select: { status: true, payment_method: true, amount: true },
        },
      },
      orderBy: [{ reservation_date: 'desc' }, { start_hour: 'asc' }],
    });
  }

  /** Vue globale des réservations (admin BO). */
  findAllAdmin(query: { date?: string; status?: string }) {
    return this.prisma.reservation.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.date ? { reservation_date: new Date(query.date) } : {}),
      },
      include: {
        terrain: { select: { id: true, name: true, city: true } },
        user: { select: { id: true, full_name: true, avatar_url: true } },
        payment: { select: { status: true, payment_method: true, amount: true } },
      },
      orderBy: [{ reservation_date: 'desc' }, { start_hour: 'asc' }],
    });
  }

  /** Réservations du joueur connecté (accueil mobile). */
  findMine(user: UserPayload) {
    return this.prisma.reservation.findMany({
      where: { user_id: user.id },
      orderBy: [{ reservation_date: 'desc' }, { start_hour: 'desc' }],
      include: { terrain: { select: { id: true, name: true, city: true, surface: true } } },
      take: 50,
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

  /** Création d'une réservation (côté joueur / app mobile). */
  async create(dto: CreateReservationDto, user: UserPayload) {
    const terrain = await this.prisma.terrain.findUnique({
      where: { id: dto.terrain_id },
    });
    if (!terrain) throw new NotFoundException('Terrain introuvable');

    const duration = dto.end_hour - dto.start_hour;
    const unit = terrain.price_per_hour;
    const total = unit * duration;
    const fee = Math.round(total * PLATFORM_FEE_RATE);

    return this.prisma.reservation.create({
      data: {
        terrain_id: dto.terrain_id,
        user_id: user.id,
        reservation_date: new Date(dto.reservation_date),
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
  async summary(user: UserPayload) {
    const ids = await this.partnerTerrainIds(user);
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

    const reservations = await this.prisma.reservation.findMany({
      where: { terrain_id: { in: ids } },
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

    // Taux d'occupation du jour = heures réservées / heures ouvrables (12h/terrain)
    const bookedHoursToday = reservations
      .filter((r) => sameDay(new Date(r.reservation_date), now))
      .reduce((s, r) => s + r.duration_hours, 0);
    const openHours = ids.length * 12;
    const occupancy_rate = openHours
      ? Math.round((bookedHoursToday / openHours) * 100)
      : 0;

    return {
      today_count: reservations.filter((r) =>
        sameDay(new Date(r.reservation_date), now),
      ).length,
      today_revenue,
      week_revenue,
      month_revenue,
      occupancy_rate,
      total_reservations: reservations.length,
    };
  }

  private async partnerTerrainIds(user: UserPayload): Promise<string[]> {
    const terrains = await this.prisma.terrain.findMany({
      where: { partner_id: user.id },
      select: { id: true },
    });
    return terrains.map((t) => t.id);
  }

  private async assertPartnerOwns(id: string, user: UserPayload) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { terrain: { select: { partner_id: true } } },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    if (reservation.terrain.partner_id !== user.id) {
      throw new ForbiddenException('Accès refusé à cette réservation');
    }
    return reservation;
  }
}
