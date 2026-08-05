-- Les profils applicatifs ne contiennent pas l'e-mail Auth. Les propriétaires
-- historiques ne doivent donc jamais afficher une adresse technique inventée.
ALTER TABLE public.partner_accesses
  ALTER COLUMN email DROP NOT NULL;

UPDATE public.partner_accesses
SET email = NULL
WHERE email LIKE 'partner-%@gbonhifoot.local';
