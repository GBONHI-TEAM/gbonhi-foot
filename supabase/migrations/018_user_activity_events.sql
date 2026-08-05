-- Événements fonctionnels utilisés par les KPI, sans journaliser de contenu
-- personnel ou de données de paiement.
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'LOGIN', 'MODE_SELECTED', 'PLAYER_PROFILE_COMPLETED', 'TEAM_CREATED',
    'TEAM_JOINED', 'LEAGUE_VIEWED', 'LEAGUE_JOINED', 'TERRAIN_VIEWED',
    'RESERVATION_STARTED', 'RESERVATION_CREATED', 'PAYMENT_COMPLETED'
  )),
  mode TEXT CHECK (mode IN ('leagues', 'reservation')),
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_activity_events_user_occurred_idx
  ON public.user_activity_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_events_type_occurred_idx
  ON public.user_activity_events (type, occurred_at DESC);
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_activity_events_admin_read" ON public.user_activity_events
  FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('SUPER_ADMIN', 'ADMIN'));
CREATE POLICY "user_activity_events_self_insert" ON public.user_activity_events
  FOR INSERT WITH CHECK (user_id = auth.uid());
