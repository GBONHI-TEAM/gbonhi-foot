import { IsIn, IsOptional, IsString } from 'class-validator';

export class ChangeReservationStatusDto {
  @IsIn(['pending', 'confirmed', 'cancelled', 'completed', 'no_show'])
  status: string;

  @IsOptional()
  @IsString()
  cancel_reason?: string;
}
