CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  home_team_id    UUID NOT NULL REFERENCES teams(id),
  away_team_id    UUID NOT NULL REFERENCES teams(id),
  home_score      INTEGER NOT NULL DEFAULT 0,
  away_score      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled', 'postponed')),
  round           INTEGER,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  venue           TEXT,
  referee_id      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT different_teams CHECK (home_team_id != away_team_id)
);

CREATE TABLE match_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id    UUID NOT NULL REFERENCES teams(id),
  player_id  UUID REFERENCES profiles(id),
  type       TEXT NOT NULL CHECK (type IN ('goal', 'yellow_card', 'red_card', 'substitution', 'own_goal')),
  minute     INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 120),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE OR REPLACE FUNCTION update_match_score_on_goal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('goal', 'own_goal') THEN
    IF NEW.type = 'goal' AND NEW.team_id = (SELECT home_team_id FROM matches WHERE id = NEW.match_id) THEN
      UPDATE matches SET home_score = home_score + 1 WHERE id = NEW.match_id;
    ELSIF NEW.type = 'goal' AND NEW.team_id = (SELECT away_team_id FROM matches WHERE id = NEW.match_id) THEN
      UPDATE matches SET away_score = away_score + 1 WHERE id = NEW.match_id;
    ELSIF NEW.type = 'own_goal' AND NEW.team_id = (SELECT home_team_id FROM matches WHERE id = NEW.match_id) THEN
      UPDATE matches SET away_score = away_score + 1 WHERE id = NEW.match_id;
    ELSIF NEW.type = 'own_goal' AND NEW.team_id = (SELECT away_team_id FROM matches WHERE id = NEW.match_id) THEN
      UPDATE matches SET home_score = home_score + 1 WHERE id = NEW.match_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_match_event_goal
  AFTER INSERT ON match_events
  FOR EACH ROW EXECUTE PROCEDURE update_match_score_on_goal();

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_public_read" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_organizer_manage" ON matches
  FOR ALL USING (
    auth.uid() IN (SELECT organizer_id FROM tournaments WHERE id = tournament_id)
    OR auth.uid() = referee_id
  );

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_events_public_read" ON match_events FOR SELECT USING (true);
CREATE POLICY "match_events_referee_insert" ON match_events
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT referee_id FROM matches WHERE id = match_id)
    OR auth.uid() IN (
      SELECT organizer_id FROM tournaments t
      JOIN matches m ON m.tournament_id = t.id
      WHERE m.id = match_id
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_scheduled_at ON matches(scheduled_at);
CREATE INDEX idx_match_events_match ON match_events(match_id);;
