-- Migration 013 : corrige les alertes Security Advisor Supabase.
-- Les écritures applicatives passent par l'API NestJS (service Prisma), jamais
-- directement par le client Supabase. L'activation de RLS bloque donc toute
-- lecture/écriture directe non explicitement autorisée.

-- Les avis sont publics : ils sont affichés sur la fiche d'un terrain. Leur
-- création et leur mise à jour restent exclusivement contrôlées par l'API,
-- qui vérifie qu'une réservation confirmée est terminée.
ALTER TABLE IF EXISTS public.terrain_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terrain_reviews_public_read" ON public.terrain_reviews;
CREATE POLICY "terrain_reviews_public_read"
  ON public.terrain_reviews
  FOR SELECT
  USING (true);

-- Coûts internes : aucune politique client. Seuls les rôles serveur/Prisma et
-- les endpoints admin autorisés peuvent y accéder.
ALTER TABLE IF EXISTS public.finance_costs ENABLE ROW LEVEL SECURITY;

-- Tickets support : aucune politique client. Les contrôles d'appartenance et
-- de rôle sont assurés par les endpoints NestJS dédiés.
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Une vue PostgreSQL est SECURITY DEFINER par défaut. SECURITY INVOKER force
-- l'application des droits et des RLS de l'appelant sur reservations/terrains.
-- Ainsi, un client ne peut jamais contourner les politiques sous-jacentes.
ALTER VIEW IF EXISTS public.partner_revenue_summary
  SET (security_invoker = true);
