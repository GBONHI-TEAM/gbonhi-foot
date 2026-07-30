import { IsOptional, IsInt, IsString, IsDateString, IsIn } from 'class-validator';

/**
 * NB : les identifiants sont validés en `@IsString()` (et non `@IsUUID()`) car
 * les données seedées utilisent des UUID non conformes RFC-4122 (nibble de
 * variante hors [89ab]) que `@IsUUID()` rejetterait.
 */
export class CreateMatchDto {
  @IsOptional()
  @IsString()
  tournament_id?: string;

  @IsString()
  home_team_id: string;

  @IsString()
  away_team_id: string;

  @IsDateString()
  scheduled_at: string;

  @IsOptional()
  @IsInt()
  round?: number;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsString()
  referee_id?: string;

  @IsOptional()
  @IsIn(['PROGRAMMÉ', 'PUBLIÉ', 'EN_COURS', 'TERMINÉ', 'VALIDÉ', 'REPORTÉ', 'ANNULÉ'])
  status?: string;
}
