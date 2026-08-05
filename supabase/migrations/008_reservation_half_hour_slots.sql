-- Réservations à la demi-heure : 1 h, 1 h 30, 2 h, etc.
-- Les créneaux et la tarification restent exprimés en heures, mais peuvent
-- désormais porter une fraction .5.

-- La colonne calculée dépend des deux heures : PostgreSQL impose de la
-- retirer avant de modifier leur type, puis de la reconstruire ensuite.
ALTER TABLE reservations DROP COLUMN duration_hours;

ALTER TABLE reservations
  ALTER COLUMN start_hour TYPE DOUBLE PRECISION USING start_hour::DOUBLE PRECISION,
  ALTER COLUMN end_hour TYPE DOUBLE PRECISION USING end_hour::DOUBLE PRECISION;

ALTER TABLE reservations
  ADD COLUMN duration_hours DOUBLE PRECISION
  GENERATED ALWAYS AS (end_hour - start_hour) STORED;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS valid_hours;
ALTER TABLE reservations
  ADD CONSTRAINT valid_hours CHECK (
    start_hour >= 6
    AND end_hour <= 23
    AND end_hour > start_hour
    AND start_hour * 2 = FLOOR(start_hour * 2)
    AND end_hour * 2 = FLOOR(end_hour * 2)
  );
