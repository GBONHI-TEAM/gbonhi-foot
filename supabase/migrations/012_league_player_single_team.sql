-- Un membre actif ne peut représenter qu'une seule équipe par ligue.
-- Cette table matérialise la règle et son index unique protège aussi contre
-- les doubles requêtes concurrentes.
CREATE TABLE league_player_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT league_player_one_team_per_tournament UNIQUE (tournament_id, user_id)
);

-- Les inscriptions déjà existantes sont reprises. En cas d'historique ancien
-- incohérent, la première inscription conservée devient la référence : les
-- nouveaux flux, eux, refuseront tout doublon de façon explicite.
INSERT INTO league_player_registrations (tournament_id, team_id, user_id)
SELECT tt.tournament_id, tt.team_id, tm.user_id
FROM tournament_teams tt
JOIN team_members tm ON tm.team_id = tt.team_id
WHERE tm.status = 'active'
ON CONFLICT (tournament_id, user_id) DO NOTHING;

ALTER TABLE league_player_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_player_registrations_own_read" ON league_player_registrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_league_player_registrations_team_user
  ON league_player_registrations(team_id, user_id);
