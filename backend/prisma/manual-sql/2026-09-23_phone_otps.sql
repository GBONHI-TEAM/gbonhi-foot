-- Codes OTP de vérification par SMS (Orange). Le code n'est jamais stocké en
-- clair : seul son hachage (HMAC-SHA256) est conservé, avec expiration.
-- Appliqué sur Supabase le 2026-09-23.
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  email       text,
  purpose     text NOT NULL DEFAULT 'register',
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON public.phone_otps(phone, created_at DESC);
