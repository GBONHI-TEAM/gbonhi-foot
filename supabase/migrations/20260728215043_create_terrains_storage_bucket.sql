insert into storage.buckets (id, name, public)
values ('terrains', 'terrains', true)
on conflict (id) do update set public = true;

drop policy if exists "terrains_public_read" on storage.objects;
drop policy if exists "terrains_auth_insert" on storage.objects;
drop policy if exists "terrains_auth_update" on storage.objects;
drop policy if exists "terrains_auth_delete" on storage.objects;

create policy "terrains_public_read" on storage.objects
  for select using (bucket_id = 'terrains');
create policy "terrains_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'terrains');
create policy "terrains_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'terrains');
create policy "terrains_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'terrains');;
