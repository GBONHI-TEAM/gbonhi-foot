import { IsDateString, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateBlockDto {
  @IsDateString()
  blocked_date: string;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(22)
  start_hour?: number;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(23)
  end_hour?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
