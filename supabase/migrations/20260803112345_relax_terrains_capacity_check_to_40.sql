ALTER TABLE terrains DROP CONSTRAINT IF EXISTS terrains_capacity_check;
ALTER TABLE terrains ADD CONSTRAINT terrains_capacity_check CHECK (capacity > 0 AND capacity <= 40);;
