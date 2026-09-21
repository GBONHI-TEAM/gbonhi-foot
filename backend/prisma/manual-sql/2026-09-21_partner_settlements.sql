-- Reversements partenaires (soldes de paiement) + lien sur les réservations.
-- Appliqué sur Supabase le 2026-09-21.
CREATE TABLE IF NOT EXISTS public.partner_settlements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    uuid NOT NULL REFERENCES public.profiles(id),
  amount        integer NOT NULL,
  gross_amount  integer NOT NULL DEFAULT 0,
  commission    integer NOT NULL DEFAULT 0,
  transactions  integer NOT NULL DEFAULT 0,
  method        text NOT NULL DEFAULT 'cash',
  reference     text,
  note          text,
  period_from   date,
  period_to     date,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Rattache chaque réservation soldée à son reversement (évite le double paiement).
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS settlement_id uuid REFERENCES public.partner_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_settlement ON public.reservations(settlement_id);
CREATE INDEX IF NOT EXISTS idx_partner_settlements_partner ON public.partner_settlements(partner_id, created_at DESC);
