import { IsString, IsOptional } from 'class-validator';

export class CreateLeagueCheckoutDto {
  // Même convention que les autres DTO d'équipe : les UUID de seed sont
  // vérifiés par PostgreSQL, pas par le validateur HTTP.
  @IsString()
  team_id: string;

  // Moyen de paiement (cash, wave, orange, mtn, moov). Défaut : cash.
  @IsOptional()
  @IsString()
  payment_method?: string;
}
