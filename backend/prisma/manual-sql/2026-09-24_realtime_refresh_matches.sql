-- Après les ALTER TABLE sur `matches` (ajout is_paused/added_time_*), Supabase
-- Realtime pouvait cesser de livrer les changements (cache de schéma). On force
-- le rechargement en re-publiant la table, et on passe en REPLICA IDENTITY FULL
-- pour des événements UPDATE fiables. Appliqué le 2026-09-24.
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.match_events REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime DROP TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
