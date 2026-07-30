import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import type { UserPayload } from '../../common/types/user-payload.type';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user: UserPayload;
    }>();

    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Token manquant');

    const { data, error } = await this.supabase.client.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Token invalide');

    request.user = {
      id: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      role: (data.user.user_metadata?.role as string | undefined) ?? 'player',
    };

    return true;
  }
}
