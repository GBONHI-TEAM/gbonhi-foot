import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { NotificationsService } from '../notifications/notifications.service';

export interface TicketRow {
  id: string;
  user_id: string | null;
  kind: string;
  category: string | null;
  subject: string;
  message: string;
  status: string;
  priority: string;
  match_id: string | null;
  terrain_id: string | null;
  response: string | null;
  responded_by: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  reporter_name?: string | null;
  reporter_avatar?: string | null;
}

function isAdminStaff(user: UserPayload): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'SUPPORT', 'OPERATEUR'].includes((user.role ?? '').toUpperCase());
}

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Création d'un ticket par l'utilisateur connecté. */
  async create(user: UserPayload, dto: CreateTicketDto) {
    const kind = dto.kind === 'incident' ? 'incident' : 'support';
    const rows = await this.prisma.$queryRaw<TicketRow[]>`
      INSERT INTO support_tickets (user_id, kind, category, subject, message, priority, match_id, terrain_id)
      VALUES (
        ${user.id}::uuid, ${kind}, ${dto.category ?? null}, ${dto.subject}, ${dto.message},
        ${dto.priority ?? 'normale'}, ${dto.match_id ?? null}::uuid, ${dto.terrain_id ?? null}::uuid
      )
      RETURNING *`;
    return rows[0];
  }

  /** Liste (admin) filtrable par kind et status. */
  async list(user: UserPayload, kind?: string, status?: string) {
    // Un partenaire peut consulter ses propres demandes depuis son portail,
    // jamais les tickets de l'ensemble de la plateforme.
    if (!isAdminStaff(user)) {
      return this.prisma.supportTicket.findMany({
        where: { user_id: user.id, ...(kind ? { kind } : {}), ...(status ? { status } : {}) },
        orderBy: { created_at: 'desc' },
        take: 100,
      });
    }

    const conditions: Prisma.Sql[] = [];
    if (kind) conditions.push(Prisma.sql`t.kind = ${kind}`);
    if (status) conditions.push(Prisma.sql`t.status = ${status}`);
    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    return this.prisma.$queryRaw<TicketRow[]>`
      SELECT t.*, p.full_name AS reporter_name, p.avatar_url AS reporter_avatar
      FROM support_tickets t
      LEFT JOIN profiles p ON p.id = t.user_id
      ${where}
      ORDER BY
        CASE t.status WHEN 'ouvert' THEN 0 WHEN 'en_cours' THEN 1 WHEN 'resolu' THEN 2 ELSE 3 END,
        CASE t.priority WHEN 'critique' THEN 0 WHEN 'haute' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END,
        t.created_at DESC
      LIMIT 300`;
  }

  /** Compteurs par statut (badges BO). */
  async counts(user: UserPayload, kind?: string) {
    if (!isAdminStaff(user)) {
      const rows = await this.prisma.supportTicket.groupBy({
        by: ['status'],
        where: { user_id: user.id, ...(kind ? { kind } : {}) },
        _count: { _all: true },
      });
      const out: Record<string, number> = { ouvert: 0, en_cours: 0, resolu: 0, ferme: 0 };
      for (const row of rows) out[row.status] = row._count._all;
      return out;
    }
    const where = kind ? Prisma.sql`WHERE kind = ${kind}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT status, COUNT(*)::bigint AS count FROM support_tickets ${where} GROUP BY status`;
    const out: Record<string, number> = { ouvert: 0, en_cours: 0, resolu: 0, ferme: 0 };
    for (const r of rows) out[r.status] = Number(r.count);
    return out;
  }

  /** Mes tickets (utilisateur mobile). */
  async mine(user: UserPayload) {
    return this.prisma.$queryRaw<TicketRow[]>`
      SELECT * FROM support_tickets WHERE user_id = ${user.id}::uuid ORDER BY created_at DESC LIMIT 100`;
  }

  async findOne(user: UserPayload, id: string) {
    const rows = await this.prisma.$queryRaw<TicketRow[]>`
      SELECT t.*, p.full_name AS reporter_name, p.avatar_url AS reporter_avatar
      FROM support_tickets t LEFT JOIN profiles p ON p.id = t.user_id
      WHERE t.id = ${id}::uuid`;
    const ticket = rows[0];
    if (!ticket) throw new NotFoundException('Ticket introuvable');
    if (!isAdminStaff(user) && ticket.user_id !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }
    return ticket;
  }

  /** Mise à jour (admin) : statut, priorité, réponse. Notifie l'auteur. */
  async update(user: UserPayload, id: string, dto: UpdateTicketDto) {
    if (!isAdminStaff(user)) throw new ForbiddenException('Accès réservé à l\'administration');

    const existingRows = await this.prisma.$queryRaw<TicketRow[]>`
      SELECT * FROM support_tickets WHERE id = ${id}::uuid`;
    const existing = existingRows[0];
    if (!existing) throw new NotFoundException('Ticket introuvable');

    const sets: Prisma.Sql[] = [Prisma.sql`updated_at = now()`];
    if (dto.status) sets.push(Prisma.sql`status = ${dto.status}`);
    if (dto.priority) sets.push(Prisma.sql`priority = ${dto.priority}`);
    if (dto.response !== undefined) {
      sets.push(Prisma.sql`response = ${dto.response}`);
      sets.push(Prisma.sql`responded_by = ${user.id}::uuid`);
    }
    if (dto.status === 'resolu' || dto.status === 'ferme') {
      sets.push(Prisma.sql`resolved_at = now()`);
    }

    const rows = await this.prisma.$queryRaw<TicketRow[]>`
      UPDATE support_tickets SET ${Prisma.join(sets, ', ')} WHERE id = ${id}::uuid RETURNING *`;
    const updated = rows[0];

    // Notifier l'auteur d'une réponse ou d'un changement de statut.
    if (existing.user_id) {
      const gotResponse = dto.response !== undefined && dto.response !== existing.response;
      const statusChanged = dto.status && dto.status !== existing.status;
      if (gotResponse || statusChanged) {
        await this.notifications.notify(existing.user_id, {
          type: 'support_update',
          title: gotResponse ? 'Réponse du support' : 'Ticket mis à jour',
          body: gotResponse
            ? `Le support a répondu à « ${existing.subject} ».`
            : `Statut de « ${existing.subject} » : ${dto.status}.`,
          data: { ticket_id: id },
        });
      }
    }

    return updated;
  }
}
