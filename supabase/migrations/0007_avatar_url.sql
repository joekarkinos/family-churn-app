-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Zdjęcia profilowe
-- Kolumna avatar_url (zdjęcie ma pierwszeństwo nad avatar_emoji).
-- Publiczny bucket 'avatars', ścieżka {userId}/{uuid}.webp.
-- Zapis: własny folder (auth.uid()) albo rodzic (is_parent()).
-- ─────────────────────────────────────────────────────────────────

alter table public.app_users add column avatar_url text;

-- Publiczny bucket na avatary (limit 2 MB, tylko obrazy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Odczyt publiczny.
create policy "avatars read public"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Zapis/nadpis/usuń: pierwszy segment ścieżki = userId (własny folder) albo rodzic.
create policy "avatars insert own or parent"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  );

create policy "avatars update own or parent"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  )
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  );

create policy "avatars delete own or parent"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  );
