-- Favoris explicites des joueurs : une réservation ne crée jamais un favori.

CREATE TABLE terrain_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id UUID NOT NULL REFERENCES terrains(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT terrain_favorites_unique UNIQUE (terrain_id, user_id)
);

ALTER TABLE terrain_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terrain_favorites_own_read" ON terrain_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "terrain_favorites_own_insert" ON terrain_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "terrain_favorites_own_delete" ON terrain_favorites
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_terrain_favorites_user ON terrain_favorites(user_id, created_at DESC);
CREATE INDEX idx_terrain_favorites_terrain ON terrain_favorites(terrain_id);
