import { IsString, IsNumber, Min, Max, Matches } from 'class-validator';

/** Report / reprogrammation d'une réservation (admin) : nouvelle date + créneau. */
export class RescheduleReservationDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date attendue au format AAAA-MM-JJ.' })
  reservation_date: string;

  @IsNumber()
  @Min(0)
  @Max(24)
  start_hour: number;

  @IsNumber()
  @Min(0)
  @Max(24)
  end_hour: number;
}
