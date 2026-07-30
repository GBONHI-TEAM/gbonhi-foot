import { IsIn } from 'class-validator';

export class ChangeMatchStatusDto {
  @IsIn(['PROGRAMMÉ', 'PUBLIÉ', 'EN_COURS', 'TERMINÉ', 'VALIDÉ', 'REPORTÉ', 'ANNULÉ'])
  status: string;
}
