-- Accès délégués au portail partenaire. Les mots de passe restent exclusivement
-- gérés par Supabase Auth : cette table ne stocke aucune donnée secrète.
CREATE TABLE IF NOT EXISTS public.partner_accesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MANAGER' CHECK (role IN ('OWNER', 'MANAGER')),
  status TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  invited_by_id UUID,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_accesses_partner_user_unique UNIQUE (partner_id, user_id)
);

CREATE INDEX IF NOT EXISTS partner_accesses_user_status_idx
  ON public.partner_accesses (user_id, status);
CREATE INDEX IF NOT EXISTS partner_accesses_partner_status_idx
  ON public.partner_accesses (partner_id, status);

-- Les propriétaires déjà reliés à au moins un terrain reçoivent leur accès
-- propriétaire automatiquement. Cette opération est idempotente.
INSERT INTO public.partner_accesses (
  partner_id, user_id, email, role, status, accepted_at
)
SELECT DISTINCT
  t.partner_id,
  t.partner_id,
  COALESCE(p.username, concat('partner-', t.partner_id::text, '@gbonhifoot.local')),
  'OWNER',
  'ACTIVE',
  now()
FROM public.terrains t
JOIN public.profiles p ON p.id = t.partner_id
ON CONFLICT (partner_id, user_id) DO NOTHING;

ALTER TABLE public.partner_accesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_accesses_admin_all" ON public.partner_accesses;
CREATE POLICY "partner_accesses_admin_all" ON public.partner_accesses
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('SUPER_ADMIN', 'ADMIN'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "partner_accesses_member_read" ON public.partner_accesses;
CREATE POLICY "partner_accesses_member_read" ON public.partner_accesses
  FOR SELECT
  USING (user_id = auth.uid());
