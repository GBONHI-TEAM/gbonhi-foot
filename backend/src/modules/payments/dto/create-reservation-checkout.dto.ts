import { IsIn, IsOptional, IsString } from 'class-validator';
import { CreateReservationDto } from '../../reservations/dto/create-reservation.dto';

export class CreateReservationCheckoutDto extends CreateReservationDto {
  // Les valeurs historiques restent tolérées pendant la mise à jour des
  // clients. Elles sont toutes ignorées : le backend enregistre uniquement
  // une validation simulée tant que CinetPay est désactivé.
  @IsOptional()
  @IsIn(['simulation', 'wave', 'orange', 'mtn', 'card'])
  payment_method?: 'simulation' | 'wave' | 'orange' | 'mtn' | 'card';

  @IsOptional()
  @IsString()
  customer_phone?: string;
}
