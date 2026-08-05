alter table public.tournaments
  add column if not exists level text,
  add column if not exists registration_fee integer not null default 0,
  add column if not exists matches_per_team integer,
  add column if not exists rules text,
  add column if not exists rewards text;

insert into storage.buckets (id, name, public)
values ('leagues', 'leagues', true)
on conflict (id) do update set public = true;

drop policy if exists "leagues_public_read" on storage.objects;
drop policy if exists "leagues_auth_insert" on storage.objects;
drop policy if exists "leagues_auth_update" on storage.objects;
drop policy if exists "leagues_auth_delete" on storage.objects;

create policy "leagues_public_read" on storage.objects for select using (bucket_id = 'leagues');
create policy "leagues_auth_insert" on storage.objects for insert to authenticated with check (bucket_id = 'leagues');
create policy "leagues_auth_update" on storage.objects for update to authenticated using (bucket_id = 'leagues');
create policy "leagues_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'leagues');;
