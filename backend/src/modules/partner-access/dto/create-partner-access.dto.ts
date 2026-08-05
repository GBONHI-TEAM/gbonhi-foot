import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreatePartnerAccessDto {
  @IsUUID()
  partnerId: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsIn(['OWNER', 'MANAGER'])
  role: 'OWNER' | 'MANAGER';

  @IsOptional()
  @IsString()
  @MinLength(2)
  username?: string;
}
