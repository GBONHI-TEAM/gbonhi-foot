-- Colonnes de contrôle live du match (accédées en SQL brut, hors schéma Prisma,
-- comme `phase` et `controller_name`). Appliqué sur Supabase le 2026-09-21.
--   is_paused          : arrêt de jeu (true) / jeu en cours (false)
--   added_time_first   : minutes de temps additionnel de la 1re mi-temps
--   added_time_second  : minutes de temps additionnel de la 2e mi-temps
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS added_time_first smallint,
  ADD COLUMN IF NOT EXISTS added_time_second smallint;
