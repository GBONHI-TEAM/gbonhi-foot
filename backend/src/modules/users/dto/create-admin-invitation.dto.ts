import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ADMIN_ROLES, type AdminRole } from '../../../common/access/roles';

export class CreateAdminInvitationDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsIn(ADMIN_ROLES)
  role: AdminRole;

  @IsOptional()
  @IsString()
  @MinLength(2)
  username?: string;
}
