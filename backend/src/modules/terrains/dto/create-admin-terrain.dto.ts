import { IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTerrainDto } from './create-terrain.dto';

/** Horaires d'ouverture d'un jour : on génère un créneau horaire par heure entre start et end. */
export class TerrainOpeningDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @IsInt()
  @Min(0)
  @Max(23)
  start_hour: number;

  @IsInt()
  @Min(1)
  @Max(24)
  end_hour: number;
}

/**
 * Création depuis le back-office : un terrain doit toujours être rattaché
 * explicitement au compte partenaire qui l'exploitera. `hours` (optionnel)
 * décrit les jours ouverts et leurs plages ; le service en dérive les créneaux.
 */
export class CreateAdminTerrainDto extends CreateTerrainDto {
  @IsUUID()
  partner_id: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TerrainOpeningDayDto)
  hours?: TerrainOpeningDayDto[];
}
