ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check
  CHECK (role = ANY (ARRAY['player'::text, 'coach'::text, 'assistant_coach'::text, 'captain'::text]));;
