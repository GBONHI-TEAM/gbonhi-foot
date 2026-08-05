-- Les types de notifications sont gérés par l'application (Phase 6 en ajoute
-- beaucoup : team_join_request, league_registration, match_scheduled, etc.).
-- Un CHECK rigide casse à chaque nouveau type → on le retire.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;;
