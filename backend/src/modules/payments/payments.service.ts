import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { ReservationsService } from '../reservations/reservations.service';
import { CreateReservationCheckoutDto } from './dto/create-reservation-checkout.dto';
import { CreateLeagueCheckoutDto } from './dto/create-league-checkout.dto';
import { CheckoutMethodDto } from './dto/checkout-method.dto';
import { createLeagueRegistrationReceiptPdf, createReservationReceiptPdf } from './receipt-pdf';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reservations: ReservationsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * CinetPay est volontairement désactivé jusqu'à réception des API Mobile
   * Money. Le parcours conserve une vraie réservation et une vraie trace de
   * paiement, mais valide celle-ci en simulation sans appel sortant.
   */
  async checkoutReservation(dto: CreateReservationCheckoutDto, user: UserPayload) {
    const method = await this.resolveEnabledMethod(dto.payment_method);
    const reservation = await this.reservations.create(dto, user);
    return this.confirmReservationPayment(reservation.id, user, method);
  }

  /** Validation d'une réservation déjà placée dans le panier. */
  async checkoutPendingReservation(reservationId: string, dto: CheckoutMethodDto, user: UserPayload) {
    const method = await this.resolveEnabledMethod(dto?.payment_method);
    await this.reservations.releaseExpiredPendingReservations(user.id, true);
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, user_id: user.id, status: 'pending' },
      select: { id: true },
    });
    if (!reservation) {
      throw new NotFoundException('Cette réservation n’est plus disponible dans ton panier.');
    }
    return this.confirmReservationPayment(reservation.id, user, method);
  }

  /**
   * Confirme le paiement d'une réservation.
   * - Espèces : réservation confirmée, à régler sur place au partenaire.
   * - Mobile Money : simulé tant que CinetPay n'est pas branché.
   */
  private async confirmReservationPayment(reservationId: string, user: UserPayload, method: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, user_id: user.id },
      select: { id: true, total_price: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');

    const isCash = method === 'cash';
    const prefix = isCash ? 'CASH' : 'SIM';
    const transactionId = `${prefix}-${reservation.id.replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    const payment = await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.reservation.updateMany({
        where: { id: reservation.id, user_id: user.id, status: 'pending' },
        data: { status: 'confirmed' },
      });
      if (confirmed.count === 0) {
        throw new ConflictException('Cette réservation ne peut plus être validée.');
      }
      const createdPayment = await tx.payment.create({
        data: {
          reservation_id: reservation.id,
          user_id: user.id,
          transaction_id: transactionId,
          amount: reservation.total_price,
          status: 'accepted',
          payment_method: method,
          cinetpay_data: { provider: isCash ? 'cash' : 'simulation', validated_at: new Date().toISOString() },
        },
      });
      return createdPayment;
    });

    // Suivi « État de paiement » : met à jour l'intent créé à la réservation
    // (validé pour espèces, en attente sinon) ; le crée s'il n'existe pas.
    try {
      const updated = await this.prisma.paymentIntent.updateMany({
        where: { reference: reservation.id },
        data: { status: isCash ? 'validated' : 'pending', payment_method: method, amount: reservation.total_price, updated_at: new Date() },
      });
      if (updated.count === 0) {
        await this.prisma.paymentIntent.create({
          data: { user_id: user.id, mode: 'reservation', amount: reservation.total_price, payment_method: method, reference: reservation.id, status: isCash ? 'validated' : 'pending' },
        });
      }
    } catch {
      // Traçage best-effort.
    }

    return {
      reservation_id: reservation.id,
      payment_id: payment.id,
      status: 'accepted' as const,
      payment_method: method,
      cash: isCash,
      simulation: !isCash,
    };
  }

  // ─── Moyens de paiement (config) ─────────────────────────────────────────
  /** Moyens ACTIVÉS, exposés à l'app mobile. */
  listEnabledMethods() {
    return this.prisma.paymentMethod.findMany({
      where: { enabled: true },
      orderBy: { sort_order: 'asc' },
      select: { code: true, label: true },
    });
  }

  /** Tous les moyens (vue admin, avec état activé/désactivé). */
  listAllMethods() {
    return this.prisma.paymentMethod.findMany({
      orderBy: { sort_order: 'asc' },
      select: { code: true, label: true, enabled: true },
    });
  }

  async setMethodEnabled(code: string, enabled: boolean) {
    const record = await this.prisma.paymentMethod.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('Moyen de paiement introuvable');
    return this.prisma.paymentMethod.update({
      where: { code },
      data: { enabled, updated_at: new Date() },
      select: { code: true, label: true, enabled: true },
    });
  }

  /** Valide qu'un moyen est activé avant tout paiement (défaut : espèces). */
  private async resolveEnabledMethod(code?: string): Promise<string> {
    const method = code ?? 'cash';
    const record = await this.prisma.paymentMethod.findUnique({ where: { code: method } });
    if (!record || !record.enabled) {
      throw new ServiceUnavailableException('Ce moyen de paiement est momentanément indisponible.');
    }
    return method;
  }

  async getReservationPayment(reservationId: string, user: UserPayload) {
    const payment = await this.prisma.payment.findFirst({
      where: { reservation_id: reservationId, user_id: user.id },
      select: { id: true, transaction_id: true, amount: true, status: true, payment_method: true, payment_url: true, updated_at: true },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    return payment;
  }

  /**
   * Paiement (simulé pour le moment) + inscription créés dans la même
   * transaction. Ainsi, aucun parcours ne peut produire une équipe inscrite
   * sans règlement associé, même si l'utilisateur double-clique.
   */
  async checkoutLeagueRegistration(leagueId: string, dto: CreateLeagueCheckoutDto, user: UserPayload) {
    if (!this.isSimulationEnabled()) {
      throw new ServiceUnavailableException('Les paiements en ligne sont temporairement indisponibles.');
    }
    const method = await this.resolveEnabledMethod(dto.payment_method);
    const isCash = method === 'cash';

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const [league, team] = await Promise.all([
          tx.tournament.findUnique({ where: { id: leagueId } }),
          tx.team.findUnique({ where: { id: dto.team_id } }),
        ]);
        if (!league) throw new NotFoundException('Ligue introuvable');
        if (!team) throw new NotFoundException('Équipe introuvable');
        if (league.status !== 'INSCRIPTIONS_OUVERTES') {
          throw new ConflictException('Les inscriptions ne sont pas ouvertes.');
        }
        if (!team.home_terrain_id) {
          throw new ConflictException('L’équipe doit avoir un terrain domicile pour s’inscrire à une ligue.');
        }
        await this.assertTeamRegistrationAuthority(tx, team.id, team.coach_id, user);

        const activeMembers = await tx.teamMember.findMany({
          where: { team_id: team.id, status: 'active' },
          select: { user_id: true, user: { select: { full_name: true } } },
        });
        if (activeMembers.length === 0) {
          throw new ConflictException('L’équipe doit compter au moins un membre actif pour s’inscrire.');
        }
        const memberIds = activeMembers.map((member) => member.user_id);
        const playerConflict = await tx.tournamentTeam.findFirst({
          where: {
            tournament_id: leagueId,
            team_id: { not: team.id },
            team: { members: { some: { user_id: { in: memberIds }, status: 'active' } } },
          },
          include: {
            team: { select: { name: true, members: { where: { user_id: { in: memberIds }, status: 'active' }, select: { user_id: true, user: { select: { full_name: true } } } } } },
          },
        });
        if (playerConflict) {
          const player = playerConflict.team.members[0]?.user.full_name?.trim() || 'Un joueur de cette équipe';
          throw new ConflictException(`${player} participe déjà à cette ligue avec ${playerConflict.team.name}.`);
        }

        const [existing, total] = await Promise.all([
          tx.tournamentTeam.findUnique({
            where: { tournament_id_team_id: { tournament_id: leagueId, team_id: team.id } },
            select: { id: true },
          }),
          tx.tournamentTeam.count({ where: { tournament_id: leagueId } }),
        ]);
        if (existing) throw new ConflictException('L’équipe est déjà inscrite à cette ligue.');
        if (total >= league.max_teams) throw new ConflictException('La ligue a atteint le nombre maximum d’équipes.');

        const registration = await tx.tournamentTeam.create({
          data: { tournament_id: leagueId, team_id: team.id, status: 'registered' },
          select: { id: true, registration_at: true },
        });
        const transactionId = `SIM-LIG-${registration.id.replace(/-/g, '').slice(0, 20).toUpperCase()}`;
        const payment = await tx.leagueRegistrationPayment.create({
          data: {
            tournament_id: leagueId,
            team_id: team.id,
            user_id: user.id,
            transaction_id: transactionId,
            amount: league.registration_fee,
            status: 'accepted',
            payment_method: method,
            provider_data: { provider: isCash ? 'cash' : 'simulation', validated_at: new Date().toISOString() },
          },
          select: { id: true, amount: true, status: true, transaction_id: true },
        });
        await tx.leaguePlayerRegistration.createMany({
          data: activeMembers.map((member) => ({
            tournament_id: leagueId,
            team_id: team.id,
            user_id: member.user_id,
          })),
        });
        return { registration, payment, leagueName: league.name, teamName: team.name, teamId: team.id };
      });

      const members = await this.prisma.teamMember.findMany({
        where: { team_id: result.teamId, status: 'active' },
        select: { user_id: true },
      });
      await this.notifications.notify(members.map((member) => member.user_id), {
        type: 'league_registration',
        title: 'Inscription confirmée',
        body: `${result.teamName} est inscrite à ${result.leagueName}.`,
        data: { league_id: leagueId, team_id: result.teamId },
      });

      // Traçage « État de paiement » (mode ligue).
      try {
        await this.prisma.paymentIntent.create({
          data: {
            user_id: user.id,
            mode: 'leagues',
            amount: result.payment.amount,
            payment_method: method,
            context: `${result.leagueName} — ${result.teamName}`,
            reference: result.registration.id,
            status: isCash ? 'validated' : 'pending',
          },
        });
      } catch {
        // Traçage best-effort.
      }

      return {
        registration_id: result.registration.id,
        payment_id: result.payment.id,
        amount: result.payment.amount,
        status: 'accepted' as const,
        simulation: true as const,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('L’équipe est déjà inscrite à cette ligue.');
      }
      throw error;
    }
  }

  async createLeagueRegistrationReceipt(leagueId: string, teamId: string, user: UserPayload): Promise<Buffer> {
    const payment = await this.prisma.leagueRegistrationPayment.findFirst({
      where: {
        tournament_id: leagueId,
        team_id: teamId,
        status: 'accepted',
        OR: [
          { user_id: user.id },
          { team: { coach_id: user.id } },
          { team: { members: { some: { user_id: user.id, role: 'captain', status: 'active' } } } },
        ],
      },
      include: { tournament: true, team: true },
    });
    if (!payment) throw new NotFoundException('Reçu indisponible : inscription ou paiement introuvable.');
    const dates = `${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(payment.tournament.start_date)} — ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(payment.tournament.end_date)}`;
    return createLeagueRegistrationReceiptPdf({
      reference: `GL-${payment.created_at.getUTCFullYear()}-${payment.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
      leagueName: payment.tournament.name,
      teamName: payment.team.name,
      dates,
      location: payment.tournament.location ?? 'Lieu à confirmer',
      amount: `${payment.amount.toLocaleString('fr-FR')} FCFA`,
      paymentMethod: this.paymentMethodLabel(payment.payment_method),
    });
  }

  /** CinetPay est inactif : aucun webhook ne doit pouvoir modifier une réservation. */
  handleCinetPayNotification(_payload: Record<string, unknown>) {
    return { ok: true, ignored: true, message: 'CinetPay est désactivé.' };
  }

  async createReservationReceipt(reservationId: string, user: UserPayload): Promise<Buffer> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, user_id: user.id, status: { in: ['confirmed', 'completed'] } },
      include: { terrain: true, payment: true },
    });
    if (!reservation) throw new NotFoundException('Reçu indisponible : paiement non confirmé');
    if (reservation.payment?.status !== 'accepted') {
      throw new ForbiddenException('Le reçu est disponible après validation du paiement');
    }
    const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(reservation.reservation_date);
    const time = `${this.time(reservation.start_hour)} - ${this.time(reservation.end_hour)}`;
    const duration = `${reservation.duration_hours % 1 === 0 ? reservation.duration_hours : reservation.duration_hours.toFixed(1).replace('.', ',')} h`;
    return createReservationReceiptPdf({
      reference: `GB-${reservation.created_at.getUTCFullYear()}-${reservation.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
      terrainName: reservation.terrain.name,
      address: `${reservation.terrain.address}, ${reservation.terrain.city}`,
      date,
      time,
      duration,
      amount: `${reservation.total_price.toLocaleString('fr-FR')} FCFA`,
      paymentMethod: this.paymentMethodLabel(reservation.payment.payment_method),
    });
  }

  private isSimulationEnabled() {
    return this.config.get<string>('PAYMENT_SIMULATION_ENABLED')?.trim().toLowerCase() !== 'false';
  }

  /** Libellé lisible du moyen de paiement pour l'affichage (reçu, confirmations). */
  private paymentMethodLabel(code?: string | null): string {
    const map: Record<string, string> = {
      cash: 'Espèces',
      wave: 'Wave',
      orange: 'Orange Money',
      mtn: 'MTN MoMo',
      moov: 'Moov Money',
      simulation: 'Paiement simulé',
    };
    const key = (code ?? '').toLowerCase();
    return map[key] ?? (code ? code.charAt(0).toUpperCase() + code.slice(1) : 'Paiement simulé');
  }

  private async assertTeamRegistrationAuthority(
    tx: Prisma.TransactionClient,
    teamId: string,
    coachId: string | null,
    user: UserPayload,
  ) {
    const isStaff = !['player', 'fan'].includes((user.role ?? '').toLowerCase());
    if (isStaff || coachId === user.id) return;
    const captain = await tx.teamMember.findFirst({
      where: { team_id: teamId, user_id: user.id, role: 'captain', status: 'active' },
      select: { id: true },
    });
    if (!captain) throw new ForbiddenException('Seul le capitaine peut inscrire son équipe.');
  }

  private time(value: number) {
    const hour = Math.floor(value);
    return `${String(hour).padStart(2, '0')}:${String(Math.round((value - hour) * 60)).padStart(2, '0')}`;
  }

  // ─── Suivi des tentatives de paiement (« État de paiement » admin) ──────────

  /** Créé quand l'utilisateur ouvre l'écran de paiement (statut 'opened'). */
  openIntent(user: UserPayload, dto: { mode?: string; amount?: number; payment_method?: string; context?: string }) {
    return this.prisma.paymentIntent.create({
      data: {
        user_id: user.id,
        mode: dto.mode === 'leagues' ? 'leagues' : 'reservation',
        amount: dto.amount ?? null,
        payment_method: dto.payment_method ?? null,
        context: dto.context ?? null,
        status: 'opened',
      },
    });
  }

  /** Met à jour le suivi au fil des actions (méthode choisie, statut…). */
  async updateIntent(id: string, user: UserPayload, dto: { status?: string; amount?: number; payment_method?: string; reference?: string; context?: string }) {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { id, user_id: user.id }, select: { id: true } });
    if (!intent) throw new NotFoundException('Suivi de paiement introuvable');
    const status = dto.status && ['opened', 'pending', 'validated', 'cancelled'].includes(dto.status) ? dto.status : undefined;
    return this.prisma.paymentIntent.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(dto.amount != null ? { amount: dto.amount } : {}),
        ...(dto.payment_method ? { payment_method: dto.payment_method } : {}),
        ...(dto.reference ? { reference: dto.reference } : {}),
        ...(dto.context ? { context: dto.context } : {}),
        updated_at: new Date(),
      },
    });
  }

  /** Liste admin des suivis de paiement (nom, mode, montant, statut, méthode). */
  listIntents(query: { status?: string }) {
    return this.prisma.paymentIntent.findMany({
      where: { ...(query.status ? { status: query.status } : {}) },
      include: { user: { select: { id: true, full_name: true, username: true, avatar_url: true } } },
      orderBy: { updated_at: 'desc' },
      take: 300,
    });
  }
}
