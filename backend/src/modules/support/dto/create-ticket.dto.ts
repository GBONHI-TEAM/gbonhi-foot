import { IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsIn(['support', 'incident'])
  kind?: 'support' | 'incident';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsIn(['basse', 'normale', 'haute', 'critique'])
  priority?: string;

  @IsOptional()
  @IsString()
  match_id?: string;

  @IsOptional()
  @IsString()
  terrain_id?: string;
}
