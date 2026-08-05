import { IsDateString, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateReservationDto {
  // @IsString (et non @IsUUID) : les UUID seed (ex. 2222…2201) ont des bits de
  // variante hors [89ab] que @IsUUID rejetterait. Postgres valide déjà le type uuid.
  @IsString()
  terrain_id: string;

  @IsDateString()
  reservation_date: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(6)
  @Max(22.5)
  start_hour: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(7)
  @Max(23)
  end_hour: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
