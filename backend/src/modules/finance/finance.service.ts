import { Injectable } from '@nestjs/common';
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
  async summary() {
    const reservations = await this.prisma.reservation.findMany({
      select: { total_price: true, platform_fee: true, partner_amount: true, status: true },
    });

    const ca = reservations.reduce((s, r) => s + (r.total_price ?? 0), 0);
    const commission = reservations.reduce((s, r) => s + (r.platform_fee ?? 0), 0);
    const reverse = reservations.reduce((s, r) => s + (r.partner_amount ?? 0), 0);
    const transactions = reservations.length;

    const costRows = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(amount), 0)::int AS total FROM finance_costs
    `;
    const costs = costRows[0]?.total ?? 0;

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
  async partners() {
    const reservations = await this.prisma.reservation.findMany({
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

  async listCosts(): Promise<CostRow[]> {
    return this.prisma.$queryRaw<CostRow[]>`
      SELECT id, label, category, amount,
             to_char(incurred_on, 'YYYY-MM-DD') AS incurred_on,
             created_at
      FROM finance_costs
      ORDER BY incurred_on DESC, created_at DESC
    `;
  }

  async createCost(input: { label: string; category?: string; amount: number; incurred_on?: string }, userId?: string) {
    const category = input.category?.trim() || 'AUTRE';
    const date = input.incurred_on?.trim() || new Date().toISOString().slice(0, 10);
    const rows = await this.prisma.$queryRaw<CostRow[]>`
      INSERT INTO finance_costs (label, category, amount, incurred_on, created_by)
      VALUES (${input.label}, ${category}, ${input.amount}, ${date}::date, ${userId ?? null}::uuid)
      RETURNING id, label, category, amount, to_char(incurred_on, 'YYYY-MM-DD') AS incurred_on, created_at
    `;
    return rows[0];
  }

  async deleteCost(id: string) {
    await this.prisma.$executeRaw`DELETE FROM finance_costs WHERE id = ${id}::uuid`;
    return { success: true };
  }
}
