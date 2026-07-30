import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(['ouvert', 'en_cours', 'resolu', 'ferme'])
  status?: string;

  @IsOptional()
  @IsIn(['basse', 'normale', 'haute', 'critique'])
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  response?: string;
}
