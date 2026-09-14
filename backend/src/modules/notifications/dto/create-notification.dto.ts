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

  /**
   * Segment ciblé pour une diffusion :
   *  - all / leagues / reservation : utilisateurs de l'app mobile (joueurs),
   *    en excluant les comptes admin et partenaires.
   *  - partners : uniquement les partenaires (portail partenaire).
   */
  @IsOptional()
  @IsIn(['all', 'leagues', 'reservation', 'partners'])
  target?: 'all' | 'leagues' | 'reservation' | 'partners';
}
