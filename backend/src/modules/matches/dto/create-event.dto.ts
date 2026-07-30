import { IsOptional, IsInt, IsString, IsIn, Min, Max } from 'class-validator';

/**
 * Événement de match. Pour un but (`BUT`), fournir `player_id` (buteur) et
 * éventuellement `assist_player_id` (passeur → crée aussi un événement `PASSE`).
 *
 * NB : les identifiants sont validés en `@IsString()` (et non `@IsUUID()`) car
 * les données seedées utilisent des UUID non conformes RFC-4122 (nibble de
 * variante hors [89ab]) que `@IsUUID()` rejetterait.
 */
export class CreateEventDto {
  @IsIn(['BUT', 'PASSE', 'CARTON_JAUNE', 'CARTON_ROUGE', 'CSC', 'BLESSURE'])
  type: string;

  @IsString()
  team_id: string;

  @IsOptional()
  @IsString()
  player_id?: string;

  @IsOptional()
  @IsString()
  assist_player_id?: string;

  @IsInt()
  @Min(0)
  @Max(200)
  minute: number;

  @IsOptional()
  @IsString()
  note?: string;
}
