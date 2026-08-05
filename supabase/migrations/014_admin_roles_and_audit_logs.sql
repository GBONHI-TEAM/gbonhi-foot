-- Lot Admin 1 : l'autorisation est décidée côté API depuis profiles.role.
-- Cette migration fournit un journal d'audit append-only pour les actions BO.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  role text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id text,
  method text NOT NULL,
  path text NOT NULL,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_at_idx ON public.audit_logs(actor_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Aucun accès direct depuis les clients Supabase. Le backend NestJS utilise sa
-- connexion serveur et journalise les actions administratives après succès.
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
