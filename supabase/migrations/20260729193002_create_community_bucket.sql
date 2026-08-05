INSERT INTO storage.buckets (id, name, public)
VALUES ('community', 'community', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS community_public_read ON storage.objects;
DROP POLICY IF EXISTS community_auth_insert ON storage.objects;
DROP POLICY IF EXISTS community_auth_update ON storage.objects;
DROP POLICY IF EXISTS community_auth_delete ON storage.objects;

CREATE POLICY community_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'community');
CREATE POLICY community_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'community');
CREATE POLICY community_auth_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'community');
CREATE POLICY community_auth_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'community');;
