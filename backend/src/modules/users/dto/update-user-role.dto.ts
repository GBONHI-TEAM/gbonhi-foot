import { IsIn } from 'class-validator';
import { ADMIN_ROLES, type AdminRole } from '../../../common/access/roles';

export class UpdateUserRoleDto {
  @IsIn(ADMIN_ROLES)
  role: AdminRole;
}
