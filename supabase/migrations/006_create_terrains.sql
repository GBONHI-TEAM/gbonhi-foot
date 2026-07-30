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
