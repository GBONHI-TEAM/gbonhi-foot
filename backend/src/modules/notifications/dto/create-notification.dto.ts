import { IsString, IsOptional, IsUUID, IsBoolean, IsIn } from 'class-validator';

export class CreateNotificationDto {
  /** Destinataire. Si absent, diffusion selon `target`. */
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

  /** Segment ciblé pour une diffusion : tous, joueurs (leagues) ou réservation. */
  @IsOptional()
  @IsIn(['all', 'leagues', 'reservation'])
  target?: 'all' | 'leagues' | 'reservation';
}
