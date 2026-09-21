import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CostRow {
  id: string;
  label: string;
  category: string;
  amount: number;
  incurred_on: string;
  created_at: string;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Synthèse financière globale : CA, commission, reversé, coûts, marge nette. */
  async summary(from?: string, to?: string) {
    const period = this.period(from, to);
    const reservations = await this.prisma.reservation.findMany({
      where: { reservation_date: period, status: { in: ['confirmed', 'completed'] } },
      select: { total_price: true, platform_fee: true, partner_amount: true },
    });

    const ca = reservations.reduce((s, r) => s + (r.total_price ?? 0), 0);
    const commission = reservations.reduce((s, r) => s + (r.platform_fee ?? 0), 0);
    const reverse = reservations.reduce((s, r) => s + (r.partner_amount ?? 0), 0);
    const transactions = reservations.length;

    const costs = (await this.prisma.financeCost.aggregate({ where: { incurred_on: period }, _sum: { amount: true } }))._sum.amount ?? 0;

    return {
      ca,
      commission,
      reverse,
      transactions,
      costs,
      marge: commission - costs,
    };
  }

  /** Montants dus par partenaire (regroupés depuis les réservations). */
  async partners(from?: string, to?: string) {
    const period = this.period(from, to);
    const reservations = await this.prisma.reservation.findMany({
      // Uniquement les réservations NON encore soldées (settlement_id null) :
      // dès qu'un partenaire est reversé, ses réservations sortent du « à payer ».
      where: { reservation_date: period, status: { in: ['confirmed', 'completed'] }, settlement_id: null },
      select: {
        partner_amount: true,
        status: true,
        terrain: {
          select: { id: true, name: true, partner: { select: { id: true, full_name: true } } },
        },
      },
    });

    const map = new Map<
      string,
      { partnerId: string; partnerName: string; terrains: Set<string>; amountOwed: number; transactions: number }
    >();

    for (const r of reservations) {
      const p = r.terrain?.partner;
      if (!p) continue;
      const entry =
        map.get(p.id) ??
        { partnerId: p.id, partnerName: p.full_name ?? 'Partenaire', terrains: new Set<string>(), amountOwed: 0, transactions: 0 };
      entry.amountOwed += r.partner_amount ?? 0;
      entry.transactions += 1;
      if (r.terrain?.name) entry.terrains.add(r.terrain.name);
      map.set(p.id, entry);
    }

    return Array.from(map.values())
      .map((e) => ({
        partnerId: e.partnerId,
        partnerName: e.partnerName,
        terrains: Array.from(e.terrains),
        amountOwed: e.amountOwed,
        transactions: e.transactions,
        status: 'À payer',
      }))
      .sort((a, b) => b.amountOwed - a.amountOwed);
  }

  async listCosts(from?: string, to?: string): Promise<CostRow[]> {
    const period = this.period(from, to);
    const costs = await this.prisma.financeCost.findMany({
      where: { incurred_on: period },
      orderBy: [{ incurred_on: 'desc' }, { created_at: 'desc' }],
    });
    return costs.map((cost) => ({
      id: cost.id,
      label: cost.label,
      category: cost.category,
      amount: cost.amount,
      incurred_on: cost.incurred_on.toISOString().slice(0, 10),
      created_at: cost.created_at.toISOString(),
    }));
  }

  async createCost(input: { label: string; category?: string; amount: number; incurred_on?: string }, userId?: string) {
    const category = input.category?.trim() || 'AUTRE';
    const date = this.parseDate(input.incurred_on) ?? new Date();
    const cost = await this.prisma.financeCost.create({
      data: { label: input.label, category, amount: input.amount, incurred_on: date, created_by: userId },
    });
    return {
      id: cost.id,
      label: cost.label,
      category: cost.category,
      amount: cost.amount,
      incurred_on: cost.incurred_on.toISOString().slice(0, 10),
      created_at: cost.created_at.toISOString(),
    };
  }

  async deleteCost(id: string) {
    await this.prisma.financeCost.delete({ where: { id } });
    return { success: true };
  }

  /* ─── Reversements partenaires ───────────────────────────────────────────── */

  /**
   * Solde le montant dû à un partenaire : crée un reversement (instantané pour le
   * reçu) et rattache les réservations concernées (`settlement_id`) afin qu'elles
   * ne soient plus jamais comptées comme « à payer ». Le montant reversé est
   * exactement la somme des `partner_amount` NON encore soldés de la période.
   */
  async settlePartner(
    partnerId: string,
    dto: { from?: string; to?: string; method?: string; reference?: string; note?: string },
    adminId?: string,
  ) {
    const period = this.period(dto.from, dto.to);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        settlement_id: null,
        status: { in: ['confirmed', 'completed'] },
        reservation_date: period,
        terrain: { partner_id: partnerId },
      },
      select: { id: true, partner_amount: true, total_price: true, platform_fee: true },
    });
    if (reservations.length === 0) {
      throw new BadRequestException('Aucun montant à reverser pour ce partenaire sur cette période.');
    }

    const amount = reservations.reduce((s, r) => s + (r.partner_amount ?? 0), 0);
    const gross = reservations.reduce((s, r) => s + (r.total_price ?? 0), 0);
    const commission = reservations.reduce((s, r) => s + (r.platform_fee ?? 0), 0);
    const method = (dto.method ?? 'cash').trim() || 'cash';

    const settlement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partnerSettlement.create({
        data: {
          partner_id: partnerId,
          amount,
          gross_amount: gross,
          commission,
          transactions: reservations.length,
          method,
          reference: dto.reference?.trim() || null,
          note: dto.note?.trim() || null,
          period_from: this.parseDate(dto.from),
          period_to: this.parseDate(dto.to),
          created_by: adminId,
        },
      });
      await tx.reservation.updateMany({
        where: { id: { in: reservations.map((r) => r.id) } },
        data: { settlement_id: created.id },
      });
      return created;
    });

    return this.getSettlement(settlement.id);
  }

  /** Historique des reversements (onglet « Payé »). */
  async listSettlements(from?: string, to?: string) {
    const period = this.period(from, to);
    const rows = await this.prisma.partnerSettlement.findMany({
      where: Object.keys(period).length ? { created_at: period } : {},
      include: { partner: { select: { full_name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((s) => this.serializeSettlement(s));
  }

  /** Détail d'un reversement (pour le reçu). */
  async getSettlement(id: string) {
    const s = await this.prisma.partnerSettlement.findUnique({
      where: { id },
      include: { partner: { select: { full_name: true } } },
    });
    if (!s) throw new BadRequestException('Reversement introuvable.');
    return this.serializeSettlement(s);
  }

  private serializeSettlement(s: {
    id: string; partner_id: string; amount: number; gross_amount: number; commission: number;
    transactions: number; method: string; reference: string | null; note: string | null;
    period_from: Date | null; period_to: Date | null; created_at: Date;
    partner?: { full_name: string | null } | null;
  }) {
    return {
      id: s.id,
      partnerId: s.partner_id,
      partnerName: s.partner?.full_name ?? 'Partenaire',
      amount: s.amount,
      grossAmount: s.gross_amount,
      commission: s.commission,
      transactions: s.transactions,
      method: s.method,
      reference: s.reference,
      note: s.note,
      periodFrom: s.period_from ? s.period_from.toISOString().slice(0, 10) : null,
      periodTo: s.period_to ? s.period_to.toISOString().slice(0, 10) : null,
      createdAt: s.created_at.toISOString(),
    };
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
}
