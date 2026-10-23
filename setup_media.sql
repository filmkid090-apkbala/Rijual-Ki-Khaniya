-- =====================================================================
-- Rijual Ki Khaniya: Photo / Video / Audio + Save permissions setup
-- Supabase -> SQL Editor mein poora paste karke ek baar RUN karein.
-- Dobara chalane se koi nuksaan nahi (safe to re-run).
-- =====================================================================

-- 1) stories table mein naye columns
alter table public.stories add column if not exists emoji     text default '📖';
alter table public.stories add column if not exists category  text;
alter table public.stories add column if not exists image_url text;
alter table public.stories add column if not exists video_url text;
alter table public.stories add column if not exists audio_url text;

-- 2) Table security (RLS): sab padh sakein, sirf admin badal sake
alter table public.stories enable row level security;
alter table public.admins  enable row level security;

drop policy if exists "rk_stories_public_read"   on public.stories;
drop policy if exists "rk_stories_admin_insert"  on public.stories;
drop policy if exists "rk_stories_admin_update"  on public.stories;
drop policy if exists "rk_stories_admin_delete"  on public.stories;
drop policy if exists "rk_admins_read_own"       on public.admins;

create policy "rk_stories_public_read" on public.stories
  for select to anon, authenticated using (true);

create policy "rk_admins_read_own" on public.admins
  for select to authenticated using (user_id = auth.uid());

create policy "rk_stories_admin_insert" on public.stories
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "rk_stories_admin_update" on public.stories
  for update to authenticated
  using      (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "rk_stories_admin_delete" on public.stories
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- 3) Storage bucket (public padhne ke liye, 50 MB tak ki file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-media', 'story-media', true, 52428800, array['image/*','video/*','audio/*'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800, allowed_mime_types = array['image/*','video/*','audio/*'];

-- 4) Storage permissions: upload/badalna/hatana sirf admin
drop policy if exists "rk_media_admin_insert" on storage.objects;
drop policy if exists "rk_media_admin_update" on storage.objects;
drop policy if exists "rk_media_admin_delete" on storage.objects;

create policy "rk_media_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'story-media' and exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "rk_media_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'story-media' and exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "rk_media_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'story-media' and exists (select 1 from public.admins a where a.user_id = auth.uid()));
