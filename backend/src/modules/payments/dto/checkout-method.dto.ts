import { IsBoolean, IsIn, IsOptional } from 'class-validator';

/** Codes des moyens de paiement (alignés avec la table payment_methods). */
export const PAYMENT_METHOD_CODES = ['cash', 'wave', 'orange', 'mtn', 'moov'] as const;
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

/** Corps du checkout : moyen de paiement choisi (défaut : espèces). */
export class CheckoutMethodDto {
  @IsOptional()
  @IsIn(PAYMENT_METHOD_CODES as unknown as string[])
  payment_method?: PaymentMethodCode;
}

/** Corps de l'admin pour activer/désactiver un moyen. */
export class TogglePaymentMethodDto {
  @IsBoolean()
  enabled: boolean;
}
