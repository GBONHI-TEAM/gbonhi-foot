import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  /** Destinataire. Si absent, diffusion à tous les utilisateurs. */
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  broadcast?: boolean;
}
