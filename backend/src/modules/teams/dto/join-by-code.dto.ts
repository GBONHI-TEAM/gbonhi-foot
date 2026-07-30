import { IsString, Matches } from 'class-validator';

export class JoinByCodeDto {
  @IsString()
  @Matches(/^GBF-[A-Z0-9]{4}$/, { message: 'Code format invalide (ex: GBF-A1B2)' })
  invitation_code: string;
}
