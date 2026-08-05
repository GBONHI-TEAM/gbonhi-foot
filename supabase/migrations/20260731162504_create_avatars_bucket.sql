INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_auth_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_auth_update ON storage.objects;
DROP POLICY IF EXISTS avatars_auth_delete ON storage.objects;

CREATE POLICY avatars_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY avatars_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY avatars_auth_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY avatars_auth_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');;
