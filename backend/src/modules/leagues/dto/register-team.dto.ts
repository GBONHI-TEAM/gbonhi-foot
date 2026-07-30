import { IsString } from 'class-validator';

export class RegisterTeamDto {
  // @IsString (et non @IsUUID) : cohérence avec les UUID seed non conformes RFC.
  // Postgres valide déjà le type uuid côté base.
  @IsString()
  team_id: string;
}
