import { IsIn } from 'class-validator';

export class UpdatePartnerAccessStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status: 'ACTIVE' | 'SUSPENDED';
}
