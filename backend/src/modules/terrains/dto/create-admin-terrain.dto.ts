import { IsUUID } from 'class-validator';
import { CreateTerrainDto } from './create-terrain.dto';

/**
 * Création depuis le back-office : un terrain doit toujours être rattaché
 * explicitement au compte partenaire qui l'exploitera.
 */
export class CreateAdminTerrainDto extends CreateTerrainDto {
  @IsUUID()
  partner_id: string;
}
