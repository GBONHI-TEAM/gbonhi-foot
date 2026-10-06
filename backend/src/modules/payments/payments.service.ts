import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
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
import { WaveService, WaveCheckoutSession } from './wave.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reservations: ReservationsService,
    private readonly notifications: NotificationsService,
    private readonly wave: WaveService,
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

  // ─── Paiement Wave (Checkout API) ────────────────────────────────────────
  /** Diagnostic de la config Wave (booléens, sans secret). */
  waveStatus() {
    return this.wave.diagnostics();
  }

  /**
   * État d'un intent Wave (pour que l'app sonde la confirmation après paiement).
   * Réservé au propriétaire de l'intent.
   */
  async getWaveIntentStatus(id: string, user: UserPayload) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id, user_id: user.id },
      select: { id: true, status: true, mode: true, reference: true, provider_transaction_id: true },
    });
    if (!intent) throw new NotFoundException('Suivi de paiement introuvable');
    return intent;
  }

  /**
   * Crée une session de checkout Wave pour une réservation en attente et
   * renvoie l'URL à ouvrir (wave_launch_url). La réservation reste `pending`
   * jusqu'à réception du webhook `checkout.session.completed`.
   */
  async createWaveReservationCheckout(reservationId: string, user: UserPayload) {
    if (!this.wave.configured) {
      throw new ServiceUnavailableException('Le paiement Wave n’est pas encore configuré.');
    }
    await this.resolveEnabledMethod('wave');
    await this.reservations.releaseExpiredPendingReservations(user.id, true);
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, user_id: user.id, status: 'pending' },
      select: { id: true, total_price: true },
    });
    if (!reservation) {
      throw new NotFoundException('Cette réservation n’est plus disponible dans ton panier.');
    }
    if (!reservation.total_price || reservation.total_price <= 0) {
      throw new BadRequestException('Montant de réservation invalide.');
    }

    // L'intent sert de référence stable partagée avec Wave (client_reference).
    const intent = await this.prisma.paymentIntent.create({
      data: {
        user_id: user.id,
        mode: 'reservation',
        amount: reservation.total_price,
        payment_method: 'wave',
        reference: reservation.id,
        status: 'pending',
        provider: 'wave',
      },
      select: { id: true },
    });

    const successUrl = this.buildReturnUrl(this.wave.successUrl, { intent: intent.id, status: 'success' });
    const errorUrl = this.buildReturnUrl(this.wave.errorUrl, { intent: intent.id, status: 'error' });

    const session = await this.wave.createCheckoutSession({
      amount: reservation.total_price,
      clientReference: intent.id,
      successUrl,
      errorUrl,
    });

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        provider_session_id: session.id,
        provider_transaction_id: session.transaction_id,
        checkout_url: session.wave_launch_url,
        updated_at: new Date(),
      },
    });

    return {
      intent_id: intent.id,
      reservation_id: reservation.id,
      checkout_url: session.wave_launch_url,
      session_id: session.id,
      amount: reservation.total_price,
    };
  }

  private buildReturnUrl(base: string, params: Record<string, string>): string {
    if (!base) return 'https://gbonhifoot.com';
    try {
      const url = new URL(base);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      return url.toString();
    } catch {
      return base;
    }
  }

  /**
   * Webhook Wave : vérifie la signature (corps BRUT) puis finalise le paiement.
   * Idempotent : un intent déjà `validated` est simplement acquitté.
   */
  async handleWaveWebhook(rawBody: string, signatureHeader?: string): Promise<{ received: true }> {
    if (!this.wave.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new UnauthorizedException('Signature Wave invalide.');
    }
    let event: { type?: string; data?: WaveCheckoutSession };
    try {
      event = JSON.parse(rawBody) as { type?: string; data?: WaveCheckoutSession };
    } catch {
      throw new BadRequestException('Corps du webhook illisible.');
    }
    const type = event.type ?? '';
    const session = event.data;
    if (!session?.client_reference) {
      return { received: true }; // événement non pertinent : on acquitte
    }

    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: session.client_reference },
      select: { id: true, user_id: true, mode: true, reference: true, status: true },
    });
    if (!intent) {
      this.logger.warn(`Webhook Wave : intent introuvable (${session.client_reference}).`);
      return { received: true };
    }
    if (intent.status === 'validated') {
      return { received: true }; // déjà finalisé (idempotence)
    }

    const succeeded = type === 'checkout.session.completed' || session.payment_status === 'succeeded';
    if (!succeeded) {
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'cancelled', provider_transaction_id: session.transaction_id, updated_at: new Date() },
      });
      return { received: true };
    }

    if (intent.mode === 'reservation' && intent.reference) {
      await this.finalizeReservationFromWave(intent.id, intent.reference, intent.user_id, session);
    } else if (intent.mode === 'leagues' && intent.reference) {
      await this.finalizeLeagueFromWave(intent.id, intent.reference, intent.user_id, session);
    } else {
      this.logger.warn(`Webhook Wave : mode non géré pour finalisation (${intent.mode}).`);
      await this.markIntent(intent.id, 'validated', session.transaction_id);
    }
    return { received: true };
  }

  /** Met à jour le statut d'un intent de paiement (best-effort). */
  private async markIntent(id: string, status: string, providerTransactionId?: string | null) {
    try {
      await this.prisma.paymentIntent.update({
        where: { id },
        data: { status, provider_transaction_id: providerTransactionId ?? undefined, updated_at: new Date() },
      });
    } catch {
      /* best-effort */
    }
  }

  /** Finalise une réservation payée par Wave (confirmée + paiement accepté). */
  private async finalizeReservationFromWave(
    intentId: string,
    reservationId: string,
    userId: string,
    session: WaveCheckoutSession,
  ) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, user_id: userId },
      select: { id: true, total_price: true },
    });
    if (!reservation) {
      this.logger.warn(`Webhook Wave : réservation introuvable (${reservationId}).`);
      await this.markIntent(intentId, 'validated', session.transaction_id);
      return;
    }
    const transactionId =
      session.transaction_id ?? `WAVE-${reservation.id.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.reservation.updateMany({
        where: { id: reservation.id, user_id: userId, status: 'pending' },
        data: { status: 'confirmed' },
      });
      // Déjà confirmée avec un paiement existant → on évite un doublon.
      if (confirmed.count === 0) {
        const existing = await tx.payment.findFirst({ where: { reservation_id: reservation.id }, select: { id: true } });
        if (existing) return;
      }
      await tx.payment.create({
        data: {
          reservation_id: reservation.id,
          user_id: userId,
          transaction_id: transactionId,
          amount: reservation.total_price,
          status: 'accepted',
          payment_method: 'wave',
          cinetpay_data: { provider: 'wave', session_id: session.id, validated_at: new Date().toISOString() },
        },
      });
    });
    await this.markIntent(intentId, 'validated', session.transaction_id);
  }

  /**
   * Crée une session de checkout Wave pour une INSCRIPTION EN LIGUE.
   * On pré-valide (sans écrire) pour échouer vite ; l'inscription réelle est
   * créée au webhook. Si elle devient impossible après paiement, on rembourse.
   */
  async createWaveLeagueCheckout(leagueId: string, dto: CreateLeagueCheckoutDto, user: UserPayload) {
    if (!this.wave.configured) {
      throw new ServiceUnavailableException('Le paiement Wave n’est pas encore configuré.');
    }
    await this.resolveEnabledMethod('wave');

    const { league, team } = await this.prisma.$transaction(async (tx) => {
      const [league, team] = await Promise.all([
        tx.tournament.findUnique({ where: { id: leagueId } }),
        tx.team.findUnique({ where: { id: dto.team_id } }),
      ]);
      if (!league) throw new NotFoundException('Ligue introuvable');
      if (!team) throw new NotFoundException('Équipe introuvable');
      if (league.status !== 'INSCRIPTIONS_OUVERTES') throw new ConflictException('Les inscriptions ne sont pas ouvertes.');
      if (!team.home_terrain_id) {
        throw new ConflictException('L’équipe doit avoir un terrain domicile pour s’inscrire à une ligue.');
      }
      await this.assertTeamRegistrationAuthority(tx, team.id, team.coach_id, user);
      const activeMembers = await tx.teamMember.count({ where: { team_id: team.id, status: 'active' } });
      if (activeMembers === 0) throw new ConflictException('L’équipe doit compter au moins un membre actif pour s’inscrire.');
      const existing = await tx.tournamentTeam.findUnique({
        where: { tournament_id_team_id: { tournament_id: leagueId, team_id: team.id } },
        select: { id: true },
      });
      if (existing) throw new ConflictException('L’équipe est déjà inscrite à cette ligue.');
      const total = await tx.tournamentTeam.count({ where: { tournament_id: leagueId } });
      if (total >= league.max_teams) throw new ConflictException('La ligue a atteint le nombre maximum d’équipes.');
      return { league, team };
    });

    const intent = await this.prisma.paymentIntent.create({
      data: {
        user_id: user.id,
        mode: 'leagues',
        amount: league.registration_fee,
        payment_method: 'wave',
        context: `${league.name} — ${team.name}`,
        reference: `${leagueId}:${team.id}`,
        status: 'pending',
        provider: 'wave',
      },
      select: { id: true },
    });

    const successUrl = this.buildReturnUrl(this.wave.successUrl, { intent: intent.id, status: 'success' });
    const errorUrl = this.buildReturnUrl(this.wave.errorUrl, { intent: intent.id, status: 'error' });

    const session = await this.wave.createCheckoutSession({
      amount: league.registration_fee,
      clientReference: intent.id,
      successUrl,
      errorUrl,
    });

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        provider_session_id: session.id,
        provider_transaction_id: session.transaction_id,
        checkout_url: session.wave_launch_url,
        updated_at: new Date(),
      },
    });

    return {
      intent_id: intent.id,
      league_id: leagueId,
      team_id: team.id,
      checkout_url: session.wave_launch_url,
      session_id: session.id,
      amount: league.registration_fee,
    };
  }

  /**
   * Finalise une inscription en ligue payée par Wave. Idempotent (équipe déjà
   * inscrite → on acquitte). Si l'inscription est devenue impossible après
   * paiement (place prise, conflit…), on REMBOURSE via Wave et on annule l'intent.
   */
  private async finalizeLeagueFromWave(
    intentId: string,
    reference: string,
    userId: string,
    session: WaveCheckoutSession,
  ) {
    const [leagueId, teamId] = reference.split(':');
    if (!leagueId || !teamId) {
      this.logger.warn(`Webhook Wave : référence ligue invalide (${reference}).`);
      await this.markIntent(intentId, 'validated', session.transaction_id);
      return;
    }
    // Idempotence : si l'équipe est déjà inscrite, rien à refaire.
    const already = await this.prisma.tournamentTeam.findUnique({
      where: { tournament_id_team_id: { tournament_id: leagueId, team_id: teamId } },
      select: { id: true },
    });
    if (already) {
      await this.markIntent(intentId, 'validated', session.transaction_id);
      return;
    }

    try {
      const result = await this.prisma.$transaction((tx) =>
        this.performLeagueRegistration(tx, {
          leagueId,
          teamId,
          userId,
          method: 'wave',
          transactionIdPrefix: 'WAVE-LIG',
          providerData: { provider: 'wave', session_id: session.id, validated_at: new Date().toISOString() },
          skipAuthority: true, // déjà vérifiée à la création du checkout
        }),
      );
      const members = await this.prisma.teamMember.findMany({
        where: { team_id: result.teamId, status: 'active' },
        select: { user_id: true },
      });
      await this.notifications.notify(
        members.map((member) => member.user_id),
        {
          type: 'league_registration',
          title: 'Inscription confirmée',
          body: `${result.teamName} est inscrite à ${result.leagueName}.`,
          data: { league_id: leagueId, team_id: result.teamId },
        },
      );
      await this.markIntent(intentId, 'validated', session.transaction_id);
    } catch (e) {
      // Inscription impossible après paiement → remboursement automatique.
      this.logger.error(
        `Inscription ligue impossible après paiement Wave (${reference}) : ${e instanceof Error ? e.message : e}. Remboursement…`,
      );
      try {
        await this.wave.refundCheckout(session.id);
      } catch (refundError) {
        this.logger.error(
          `Remboursement Wave échoué (${session.id}) : ${refundError instanceof Error ? refundError.message : refundError}`,
        );
      }
      await this.markIntent(intentId, 'cancelled', session.transaction_id);
    }
  }

  /** Inscription d'une équipe en ligue (validation + écritures), réutilisable. */
  private async performLeagueRegistration(
    tx: Prisma.TransactionClient,
    params: {
      leagueId: string;
      teamId: string;
      userId: string;
      user?: UserPayload;
      method: string;
      transactionIdPrefix: string;
      providerData: Prisma.InputJsonValue;
      skipAuthority?: boolean;
    },
  ) {
    const { leagueId, teamId, userId, user, method, transactionIdPrefix, providerData, skipAuthority } = params;
    const [league, team] = await Promise.all([
      tx.tournament.findUnique({ where: { id: leagueId } }),
      tx.team.findUnique({ where: { id: teamId } }),
    ]);
    if (!league) throw new NotFoundException('Ligue introuvable');
    if (!team) throw new NotFoundException('Équipe introuvable');
    if (league.status !== 'INSCRIPTIONS_OUVERTES') {
      throw new ConflictException('Les inscriptions ne sont pas ouvertes.');
    }
    if (!team.home_terrain_id) {
      throw new ConflictException('L’équipe doit avoir un terrain domicile pour s’inscrire à une ligue.');
    }
    if (!skipAuthority) {
      if (!user) throw new ForbiddenException('Autorisation requise pour inscrire cette équipe.');
      await this.assertTeamRegistrationAuthority(tx, team.id, team.coach_id, user);
    }

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
    const transactionId = `${transactionIdPrefix}-${registration.id.replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    const payment = await tx.leagueRegistrationPayment.create({
      data: {
        tournament_id: leagueId,
        team_id: team.id,
        user_id: userId,
        transaction_id: transactionId,
        amount: league.registration_fee,
        status: 'accepted',
        payment_method: method,
        provider_data: providerData,
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
      const result = await this.prisma.$transaction((tx) =>
        this.performLeagueRegistration(tx, {
          leagueId,
          teamId: dto.team_id,
          userId: user.id,
          user,
          method,
          transactionIdPrefix: 'SIM-LIG',
          providerData: { provider: isCash ? 'cash' : 'simulation', validated_at: new Date().toISOString() },
        }),
      );

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
      card: 'Carte bancaire',
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
