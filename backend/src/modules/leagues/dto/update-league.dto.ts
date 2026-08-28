import { IsString, IsOptional, IsInt, Min, Max, IsDateString, MinLength, MaxLength, IsNumber } from 'class-validator';

export class UpdateLeagueDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(32)
  max_teams?: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsNumber()
  registration_fee?: number;

  @IsOptional()
  @IsString()
  prize_info?: string;

  @IsOptional()
  @IsString()
  banner_url?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  matches_per_team?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  legs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  pool_count?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  qualifiers_per_pool?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(240)
  match_duration_min?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  round_interval_days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  rules?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rewards?: string;
}
