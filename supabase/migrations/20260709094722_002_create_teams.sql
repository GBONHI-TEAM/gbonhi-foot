CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  logo_url        TEXT,
  coach_id        UUID REFERENCES profiles(id),
  city            TEXT,
  primary_color   TEXT DEFAULT '#1E7A3A',
  secondary_color TEXT DEFAULT '#F7921E',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'player'
               CHECK (role IN ('player', 'coach', 'assistant_coach')),
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'rejected', 'left')),
  jersey_num INTEGER,
  joined_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_public_read" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_coach_insert" ON teams FOR INSERT WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "teams_coach_update" ON teams FOR UPDATE USING (auth.uid() = coach_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_public_read" ON team_members FOR SELECT USING (true);
CREATE POLICY "team_members_self_insert" ON team_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "team_members_coach_update" ON team_members
  FOR UPDATE USING (auth.uid() IN (SELECT coach_id FROM teams WHERE id = team_id));

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_teams_city ON teams(city);;
