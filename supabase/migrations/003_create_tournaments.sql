-- Migration 003: Tournaments

CREATE TABLE tournaments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  organizer_id UUID NOT NULL REFERENCES profiles(id),
  format       TEXT NOT NULL DEFAULT 'single_elimination'
                 CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin', 'league')),
  status       TEXT NOT NULL DEFAULT 'registration'
                 CHECK (status IN ('draft', 'registration', 'ongoing', 'finished', 'cancelled')),
  max_teams    INTEGER NOT NULL DEFAULT 16,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  location     TEXT,
  banner_url   TEXT,
  prize_info   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tournament_teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  registration_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered', 'confirmed', 'eliminated', 'winner')),
  UNIQUE(tournament_id, team_id)
);

-- Triggers
CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournaments_public_read" ON tournaments
  FOR SELECT USING (true);

CREATE POLICY "tournaments_organizer_insert" ON tournaments
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "tournaments_organizer_update" ON tournaments
  FOR UPDATE USING (auth.uid() = organizer_id);

ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_teams_public_read" ON tournament_teams
  FOR SELECT USING (true);

CREATE POLICY "tournament_teams_coach_register" ON tournament_teams
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT coach_id FROM teams WHERE id = team_id
    )
  );

-- Indexes
CREATE INDEX idx_tournaments_organizer ON tournaments(organizer_id);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournament_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX idx_tournament_teams_team ON tournament_teams(team_id);
