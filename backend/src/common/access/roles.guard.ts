import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserPayload } from '../types/user-payload.type';
import { ROLES_KEY } from './roles.decorator';
import type { AdminRole } from './roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: UserPayload }>();
    if (!request.user) throw new UnauthorizedException('Authentification requise');

    if (!requiredRoles.includes(request.user.role as AdminRole)) {
      throw new ForbiddenException('Vous ne disposez pas des droits nécessaires pour cette action');
    }

    return true;
  }
}
