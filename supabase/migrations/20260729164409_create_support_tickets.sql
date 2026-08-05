CREATE TABLE IF NOT EXISTS support_tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  kind         text NOT NULL DEFAULT 'support' CHECK (kind IN ('support','incident')),
  category     text,
  subject      text NOT NULL,
  message      text NOT NULL,
  status       text NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert','en_cours','resolu','ferme')),
  priority     text NOT NULL DEFAULT 'normale' CHECK (priority IN ('basse','normale','haute','critique')),
  match_id     uuid,
  terrain_id   uuid,
  response     text,
  responded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_kind_status ON support_tickets (kind, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets (user_id);;
