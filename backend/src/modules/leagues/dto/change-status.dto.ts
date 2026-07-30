import { IsString, IsOptional, IsIn } from 'class-validator';

const VALID_STATUSES = [
  'BROUILLON',
  'INSCRIPTIONS_OUVERTES',
  'INSCRIPTIONS_CLOSES',
  'EN_COURS',
  'SUSPENDUE',
  'TERMINÉE',
  'ARCHIVÉE',
];

export class ChangeStatusDto {
  @IsString()
  @IsIn(VALID_STATUSES)
  status: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
