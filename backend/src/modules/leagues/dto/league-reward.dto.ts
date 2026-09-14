import { IsString, IsOptional, IsNumber, Min, IsIn, MaxLength } from 'class-validator';

export const REWARD_TYPES = ['money', 'trophy', 'equipment', 'other'] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

/** Une récompense structurée d'une ligue (1er, meilleur buteur, prix custom…). */
export class LeagueRewardDto {
  @IsString()
  @MaxLength(80)
  label: string;

  @IsIn(REWARD_TYPES)
  type: RewardType;

  /** Montant en FCFA (uniquement pertinent pour le type 'money'). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;
}
