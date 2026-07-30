-- Migration 001: User profiles
-- Extends auth.users with app-specific data

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  username      TEXT UNIQUE,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'fan'
                  CHECK (role IN ('player', 'coach', 'organizer', 'fan', 'admin', 'partner')),
  position      TEXT CHECK (position IN ('goalkeeper', 'defender', 'midfielder', 'forward')),
  city          TEXT,
  bio           TEXT,
  fcm_token     TEXT,   -- Firebase Cloud Messaging token for push notifications
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Index
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_city ON profiles(city);
-- Migration 002: Teams and members

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

-- Triggers
CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_public_read" ON teams
  FOR SELECT USING (true);

CREATE POLICY "teams_coach_insert" ON teams
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "teams_coach_update" ON teams
  FOR UPDATE USING (auth.uid() = coach_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_public_read" ON team_members
  FOR SELECT USING (true);

CREATE POLICY "team_members_self_insert" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "team_members_coach_update" ON team_members
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT coach_id FROM teams WHERE id = team_id
    )
  );

-- Indexes
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_teams_city ON teams(city);
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
-- Migration 004: Matches and match events (realtime-enabled)

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

-- Events (goals, yellow cards, red cards, substitutions)
CREATE TABLE match_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id    UUID NOT NULL REFERENCES teams(id),
  player_id  UUID REFERENCES profiles(id),
  type       TEXT NOT NULL
               CHECK (type IN ('goal', 'yellow_card', 'red_card', 'substitution', 'own_goal')),
  minute     INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 120),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Auto-update score on goal event
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

-- RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_public_read" ON matches
  FOR SELECT USING (true);

CREATE POLICY "matches_organizer_manage" ON matches
  FOR ALL USING (
    auth.uid() IN (
      SELECT organizer_id FROM tournaments WHERE id = tournament_id
    )
    OR auth.uid() = referee_id
  );

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_events_public_read" ON match_events
  FOR SELECT USING (true);

CREATE POLICY "match_events_referee_insert" ON match_events
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT referee_id FROM matches WHERE id = match_id
    )
    OR auth.uid() IN (
      SELECT organizer_id FROM tournaments t
      JOIN matches m ON m.tournament_id = t.id
      WHERE m.id = match_id
    )
  );

-- Enable Realtime on matches and match_events
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;

-- Indexes
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_scheduled_at ON matches(scheduled_at);
CREATE INDEX idx_match_events_match ON match_events(match_id);
-- Migration 005: Community feed, notifications

CREATE TABLE community_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES teams(id) ON DELETE SET NULL,
  content     TEXT NOT NULL CHECK (char_length(content) <= 2000),
  image_url   TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE post_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'like' CHECK (type IN ('like', 'fire', 'clap')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
               CHECK (type IN ('match_start', 'match_goal', 'match_end', 'team_invite',
                               'tournament_start', 'post_reaction', 'post_comment')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update likes count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_posts
  SET likes_count = (SELECT COUNT(*) FROM post_reactions WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reaction_change
  AFTER INSERT OR DELETE ON post_reactions
  FOR EACH ROW EXECUTE PROCEDURE update_post_likes_count();

-- Auto-update comments count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_posts
  SET comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE PROCEDURE update_post_comments_count();

-- Triggers
CREATE TRIGGER community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_public_read" ON community_posts
  FOR SELECT USING (true);

CREATE POLICY "posts_author_insert" ON community_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_author_delete" ON community_posts
  FOR DELETE USING (auth.uid() = author_id);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_public_read" ON post_reactions
  FOR SELECT USING (true);

CREATE POLICY "reactions_self_manage" ON post_reactions
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_public_read" ON post_comments
  FOR SELECT USING (true);

CREATE POLICY "comments_author_insert" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "comments_author_delete" ON post_comments
  FOR DELETE USING (auth.uid() = author_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_community_posts_author ON community_posts(author_id);
CREATE INDEX idx_community_posts_team ON community_posts(team_id);
CREATE INDEX idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;
-- Migration 006: Terrains (propriétaires + disponibilités)

CREATE TABLE terrains (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 100),
  address       TEXT NOT NULL,
  city          TEXT NOT NULL DEFAULT 'Abidjan',
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  surface       TEXT NOT NULL CHECK (surface IN ('grass', 'artificial', 'futsal')),
  format        TEXT NOT NULL CHECK (format IN ('5vs5', '7vs7', '8vs8', '11vs11')),
  capacity      INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 22),
  price_per_hour INTEGER NOT NULL CHECK (price_per_hour > 0), -- en FCFA
  photos        TEXT[] NOT NULL DEFAULT '{}',
  amenities     TEXT[] NOT NULL DEFAULT '{}', -- ['lighting', 'showers', 'parking', 'canteen']
  description   TEXT,
  phone_contact TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Créneaux horaires disponibles par défaut (semaine type)
-- Chaque créneau = un slot de 1h dans la semaine
CREATE TABLE terrain_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id  UUID NOT NULL REFERENCES terrains(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Lundi, 6=Dimanche
  start_hour  INTEGER NOT NULL CHECK (start_hour BETWEEN 6 AND 22),
  end_hour    INTEGER NOT NULL CHECK (end_hour BETWEEN 7 AND 23),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_hours CHECK (end_hour = start_hour + 1),
  UNIQUE(terrain_id, day_of_week, start_hour)
);

-- Blocages ponctuels (fermeture exceptionnelle)
CREATE TABLE terrain_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id  UUID NOT NULL REFERENCES terrains(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  start_hour  INTEGER,  -- NULL = toute la journée bloquée
  end_hour    INTEGER,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
CREATE TRIGGER terrains_updated_at
  BEFORE UPDATE ON terrains
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- RLS
ALTER TABLE terrains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terrains_public_read" ON terrains
  FOR SELECT USING (is_active = true);

CREATE POLICY "terrains_partner_all" ON terrains
  FOR ALL USING (auth.uid() = partner_id);

-- Admins peuvent voir tous les terrains (actifs et inactifs)
CREATE POLICY "terrains_admin_read" ON terrains
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

ALTER TABLE terrain_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slots_public_read" ON terrain_slots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM terrains WHERE id = terrain_id AND is_active = true)
  );

CREATE POLICY "slots_partner_manage" ON terrain_slots
  FOR ALL USING (
    auth.uid() IN (SELECT partner_id FROM terrains WHERE id = terrain_id)
  );

ALTER TABLE terrain_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_public_read" ON terrain_blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM terrains WHERE id = terrain_id AND is_active = true)
  );

CREATE POLICY "blocks_partner_manage" ON terrain_blocks
  FOR ALL USING (
    auth.uid() IN (SELECT partner_id FROM terrains WHERE id = terrain_id)
  );

-- Index
CREATE INDEX idx_terrains_partner ON terrains(partner_id);
CREATE INDEX idx_terrains_city ON terrains(city);
CREATE INDEX idx_terrains_surface ON terrains(surface);
CREATE INDEX idx_terrains_active ON terrains(is_active);
CREATE INDEX idx_terrains_location ON terrains(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_slots_terrain ON terrain_slots(terrain_id);
CREATE INDEX idx_blocks_terrain_date ON terrain_blocks(terrain_id, blocked_date);
-- Migration 007: Réservations + Paiements CinetPay

CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id      UUID NOT NULL REFERENCES terrains(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reservation_date DATE NOT NULL,
  start_hour      INTEGER NOT NULL CHECK (start_hour BETWEEN 6 AND 22),
  end_hour        INTEGER NOT NULL CHECK (end_hour BETWEEN 7 AND 23),
  duration_hours  INTEGER NOT NULL GENERATED ALWAYS AS (end_hour - start_hour) STORED,
  unit_price      INTEGER NOT NULL,  -- prix/h au moment de la réservation (FCFA)
  total_price     INTEGER NOT NULL,  -- = duration_hours * unit_price
  platform_fee    INTEGER NOT NULL,  -- 10% commission Gbonhi Foot
  partner_amount  INTEGER NOT NULL,  -- total_price - platform_fee
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  cancel_reason   TEXT,
  notes           TEXT,             -- note du joueur (ex: "besoin de plots")
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_hours CHECK (end_hour > start_hour),
  CONSTRAINT no_double_booking UNIQUE (terrain_id, reservation_date, start_hour)
);

-- Paiements CinetPay liés aux réservations
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  transaction_id  TEXT NOT NULL UNIQUE, -- ID unique côté CinetPay
  amount          INTEGER NOT NULL,     -- en FCFA
  currency        TEXT NOT NULL DEFAULT 'XOF',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'accepted', 'refused', 'cancelled')),
  payment_method  TEXT,                 -- wave | orange_money | mtn_moov | visa | mastercard
  cinetpay_data   JSONB,               -- réponse complète CinetPay
  payment_url     TEXT,                -- URL redirect CinetPay
  webhook_received_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Confirmer automatiquement la réservation quand le paiement est accepté
CREATE OR REPLACE FUNCTION confirm_reservation_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    UPDATE reservations
    SET status = 'confirmed', updated_at = NOW()
    WHERE id = NEW.reservation_id;
  END IF;
  IF NEW.status = 'refused' AND OLD.status = 'pending' THEN
    UPDATE reservations
    SET status = 'cancelled', cancel_reason = 'Paiement refusé', updated_at = NOW()
    WHERE id = NEW.reservation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_status_change
  AFTER UPDATE ON payments
  FOR EACH ROW EXECUTE PROCEDURE confirm_reservation_on_payment();

-- RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Le joueur voit ses propres réservations
CREATE POLICY "reservations_own_read" ON reservations
  FOR SELECT USING (auth.uid() = user_id);

-- Le partenaire voit les réservations de son terrain
CREATE POLICY "reservations_partner_read" ON reservations
  FOR SELECT USING (
    auth.uid() IN (SELECT partner_id FROM terrains WHERE id = terrain_id)
  );

-- Admin voit tout
CREATE POLICY "reservations_admin_read" ON reservations
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Seul le joueur peut créer une réservation
CREATE POLICY "reservations_user_insert" ON reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Le joueur peut annuler sa réservation (status → cancelled)
CREATE POLICY "reservations_user_cancel" ON reservations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (status = 'cancelled');

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_own_read" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payments_partner_read" ON payments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT t.partner_id FROM terrains t
      JOIN reservations r ON r.terrain_id = t.id
      WHERE r.id = reservation_id
    )
  );

-- Seul le backend (service role) crée des paiements via webhook
-- Les clients ne peuvent que lire

-- Index
CREATE INDEX idx_reservations_terrain ON reservations(terrain_id);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_terrain_date ON reservations(terrain_id, reservation_date);
CREATE INDEX idx_payments_reservation ON payments(reservation_id);
CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Vue agrégée revenus partenaire (utile pour le dashboard)
CREATE VIEW partner_revenue_summary AS
SELECT
  t.partner_id,
  DATE_TRUNC('month', r.reservation_date) AS month,
  COUNT(r.id) AS total_reservations,
  SUM(r.total_price) AS total_revenue,
  SUM(r.partner_amount) AS partner_revenue,
  SUM(r.platform_fee) AS platform_fees
FROM reservations r
JOIN terrains t ON t.id = r.terrain_id
WHERE r.status IN ('confirmed', 'completed')
GROUP BY t.partner_id, DATE_TRUNC('month', r.reservation_date);
