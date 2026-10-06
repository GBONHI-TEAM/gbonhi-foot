-- Liaison des intents de paiement avec un prestataire externe (Wave Checkout).
-- Colonnes additives nullable → sans impact sur l'existant. Appliqué le 2026-10-06.
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_session_id text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS checkout_url text;

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_session
  ON public.payment_intents (provider_session_id);
