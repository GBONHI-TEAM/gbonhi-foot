import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreateTerrainDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsIn(['grass', 'artificial', 'futsal'])
  surface: string;

  @IsIn(['5vs5', '7vs7', '8vs8', '11vs11'])
  format: string;

  @IsInt()
  @Min(1)
  @Max(40)
  capacity: number;

  @IsInt()
  @Min(1)
  price_per_hour: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  phone_contact?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
