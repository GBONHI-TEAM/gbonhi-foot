import { IsBoolean, IsInt, Max, Min } from 'class-validator';

/** Ouvre (is_active=true) ou ferme (false) tous les créneaux d'un jour de la semaine. */
export class SetDayAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @IsBoolean()
  is_active: boolean;
}
