-- Canonicalisation des rôles applicatifs : les rôles BO sont stockés côté
-- serveur dans profiles.role et non dans user_metadata Supabase.

UPDATE public.profiles
SET role = CASE lower(role)
  WHEN 'super_admin' THEN 'SUPER_ADMIN'
  WHEN 'super-admin' THEN 'SUPER_ADMIN'
  WHEN 'admin' THEN 'ADMIN'
  WHEN 'controleur' THEN 'CONTROLEUR'
  WHEN 'contrôleur' THEN 'CONTROLEUR'
  WHEN 'controller' THEN 'CONTROLEUR'
  WHEN 'support' THEN 'SUPPORT'
  WHEN 'operateur' THEN 'OPERATEUR'
  WHEN 'opérateur' THEN 'OPERATEUR'
  ELSE lower(role)
END;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'player',
    'coach',
    'organizer',
    'fan',
    'partner',
    'SUPER_ADMIN',
    'ADMIN',
    'CONTROLEUR',
    'SUPPORT',
    'OPERATEUR'
  ));
