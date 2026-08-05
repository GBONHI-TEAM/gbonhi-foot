import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from './roles';

export const ROLES_KEY = 'gbonhi:roles';

/** Restreint un endpoint aux rôles administratifs explicitement indiqués. */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
