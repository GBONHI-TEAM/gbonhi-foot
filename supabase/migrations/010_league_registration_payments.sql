-- Inscription de ligue : l'équipe et son paiement simulé/ultérieur sont liés
-- dans une même transaction applicative. Une inscription ne doit jamais être
-- créée sans une trace de règlement.

CREATE TABLE league_registration_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  transaction_id TEXT NOT NULL UNIQUE,
  amount         INTEGER NOT NULL CHECK (amount >= 0),
  currency       TEXT NOT NULL DEFAULT 'XOF',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'accepted', 'refused', 'cancelled')),
  payment_method TEXT,
  provider_data  JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT league_registration_payments_unique UNIQUE (tournament_id, team_id),
  CONSTRAINT league_registration_payments_registration_fk
    FOREIGN KEY (tournament_id, team_id)
    REFERENCES tournament_teams(tournament_id, team_id)
    ON DELETE CASCADE
);

CREATE TRIGGER league_registration_payments_updated_at
  BEFORE UPDATE ON league_registration_payments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

ALTER TABLE league_registration_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_registration_payments_own_read" ON league_registration_payments
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT coach_id FROM teams WHERE id = team_id)
  );

CREATE INDEX idx_league_registration_payments_tournament
  ON league_registration_payments(tournament_id, created_at DESC);
CREATE INDEX idx_league_registration_payments_team
  ON league_registration_payments(team_id, created_at DESC);
