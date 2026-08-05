import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import type { UserPayload } from '../../common/types/user-payload.type';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeProfileRole } from '../../common/access/roles';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user: UserPayload;
    }>();

    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Token manquant');

    const { data, error } = await this.supabase.client.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Token invalide');

    const profile = await this.prisma.profile.findUnique({
      where: { id: data.user.id },
      select: { role: true },
    });

    request.user = {
      id: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      // La source de vérité des autorisations est la base applicative. Ne pas
      // utiliser `user_metadata`, modifiable par l'utilisateur dans Supabase.
      role: normalizeProfileRole(profile?.role),
    };

    return true;
  }
}
