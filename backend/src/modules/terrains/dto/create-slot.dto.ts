import { IsInt, Min, Max, IsOptional, IsBoolean } from 'class-validator';

export class CreateSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @IsInt()
  @Min(6)
  @Max(22)
  start_hour: number;

  @IsInt()
  @Min(7)
  @Max(23)
  end_hour: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
