import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId: string;
  role: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  requestId?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actor_id: entry.actorId,
          role: entry.role,
          action: entry.action,
          resource: entry.resource,
          resource_id: entry.resourceId,
          method: entry.method,
          path: entry.path,
          request_id: entry.requestId,
        },
      });
    } catch (error) {
      // L'audit ne doit jamais annuler une opération métier réussie si la
      // migration n'est pas encore appliquée ou si la base est indisponible.
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Écriture audit impossible : ${detail}`);
    }
  }
}
