CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id      UUID NOT NULL REFERENCES terrains(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reservation_date DATE NOT NULL,
  start_hour      INTEGER NOT NULL CHECK (start_hour BETWEEN 6 AND 22),
  end_hour        INTEGER NOT NULL CHECK (end_hour BETWEEN 7 AND 23),
  duration_hours  INTEGER NOT NULL GENERATED ALWAYS AS (end_hour - start_hour) STORED,
  unit_price      INTEGER NOT NULL,
  total_price     INTEGER NOT NULL,
  platform_fee    INTEGER NOT NULL,
  partner_amount  INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  cancel_reason   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_hours CHECK (end_hour > start_hour),
  CONSTRAINT no_double_booking UNIQUE (terrain_id, reservation_date, start_hour)
);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  transaction_id  TEXT NOT NULL UNIQUE,
  amount          INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'XOF',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'accepted', 'refused', 'cancelled')),
  payment_method  TEXT,
  cinetpay_data   JSONB,
  payment_url     TEXT,
  webhook_received_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

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

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_own_read" ON reservations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reservations_partner_read" ON reservations
  FOR SELECT USING (
    auth.uid() IN (SELECT partner_id FROM terrains WHERE id = terrain_id)
  );

CREATE POLICY "reservations_admin_read" ON reservations
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

CREATE POLICY "reservations_user_insert" ON reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

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

CREATE INDEX idx_reservations_terrain ON reservations(terrain_id);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_terrain_date ON reservations(terrain_id, reservation_date);
CREATE INDEX idx_payments_reservation ON payments(reservation_id);
CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_status ON payments(status);

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
GROUP BY t.partner_id, DATE_TRUNC('month', r.reservation_date);;
