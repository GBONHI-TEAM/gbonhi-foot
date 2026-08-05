import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, map, mergeMap } from 'rxjs';
import type { UserPayload } from '../types/user-payload.type';
import { isAdminRole } from '../access/roles';
import { AuditLogService } from './audit-log.service';

type AuditedRequest = {
  id?: string;
  method?: string;
  url?: string;
  params?: Record<string, string | undefined>;
  user?: UserPayload;
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const method = request.method?.toUpperCase();
    const user = request.user;

    if (!method || !user || !isAdminRole(user.role) || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path = request.url ?? '';
    const resource = path.split('?')[0].split('/').filter(Boolean)[2] ?? 'unknown';
    const resourceId = request.params?.id ?? request.params?.leagueId;

    return next.handle().pipe(
      mergeMap((response) =>
        from(
          this.auditLog.record({
            actorId: user.id,
            role: user.role,
            action: `${method} ${path.split('?')[0]}`,
            resource,
            resourceId,
            method,
            path,
            requestId: request.id,
          }),
        ).pipe(map(() => response)),
      ),
    );
  }
}
