import { IsString } from 'class-validator';

export class CreateLeagueCheckoutDto {
  // Même convention que les autres DTO d'équipe : les UUID de seed sont
  // vérifiés par PostgreSQL, pas par le validateur HTTP.
  @IsString()
  team_id: string;
}
