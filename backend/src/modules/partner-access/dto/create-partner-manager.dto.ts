import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/** Invitation créée par le propriétaire depuis son portail : rôle imposé MANAGER. */
export class CreatePartnerManagerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  username?: string;
}
