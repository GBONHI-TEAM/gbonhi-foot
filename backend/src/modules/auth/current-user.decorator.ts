import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserPayload } from '../../common/types/user-payload.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: UserPayload }>();
    return request.user;
  },
);
