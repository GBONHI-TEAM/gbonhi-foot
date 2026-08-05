-- Les clients ne créent jamais directement un paiement : seul le backend
-- finalise la transaction inscription + paiement. Cette règle bloque toute
-- tentative de forger un reçu via l'API Supabase publique.
DROP POLICY IF EXISTS "league_registration_payments_own_insert" ON league_registration_payments;
