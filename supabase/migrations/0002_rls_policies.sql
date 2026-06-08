-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Row Level Security policies
-- Model: każdy członek rodziny = użytkownik Supabase Auth.
--        auth.uid() = app_users.id
-- Reguły biznesowe:
--   #2  przyjęte zadanie znika z listy innych dzieci
--   #8  dziecko widzi TYLKO swoje monety; rodzice widzą wszystkich
-- ─────────────────────────────────────────────────────────────────

-- ─── Helpers ───────────────────────────────────────────────────
-- Czy zalogowany użytkownik jest rodzicem?
create or replace function public.is_parent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and role = 'parent'
  );
$$;

-- ─── app_users ─────────────────────────────────────────────────
-- Każdy zalogowany widzi profile (potrzebne do PersonPicker po imieniu/kolorze),
-- ale pin_hash i dane bankowe chronimy w warstwie zapytań/przez kolumny.
-- Dziecko może czytać profile (do UI), modyfikować może tylko rodzic albo własny profil.
create policy "app_users readable by authenticated"
  on public.app_users for select
  to authenticated
  using (true);

create policy "app_users updatable by self or parent"
  on public.app_users for update
  to authenticated
  using (id = auth.uid() or public.is_parent())
  with check (id = auth.uid() or public.is_parent());

create policy "app_users insert by parent"
  on public.app_users for insert
  to authenticated
  with check (public.is_parent());

-- ─── task_templates ────────────────────────────────────────────
-- Tylko do odczytu dla wszystkich zalogowanych; zarządzanie przez service role/seed.
create policy "templates readable by authenticated"
  on public.task_templates for select
  to authenticated
  using (true);

-- ─── tasks ─────────────────────────────────────────────────────
-- Widoczność (reguła #2):
--   rodzic widzi wszystko;
--   dziecko widzi zadania otwarte (jeszcze nieprzyjęte) ORAZ swoje przyjęte zadania.
create policy "tasks visible per role"
  on public.tasks for select
  to authenticated
  using (
    public.is_parent()
    or status = 'open'
    or claimed_by = auth.uid()
    or assigned_to = auth.uid()
  );

-- Tworzenie zadań: tylko rodzic.
create policy "tasks insert by parent"
  on public.tasks for insert
  to authenticated
  with check (public.is_parent());

-- Aktualizacja:
--   rodzic — wszystko (zatwierdzanie, edycja);
--   dziecko — może przyjąć otwarte zadanie lub zmienić swoje przyjęte (zgłoszenie).
create policy "tasks update by parent"
  on public.tasks for update
  to authenticated
  using (public.is_parent())
  with check (public.is_parent());

create policy "tasks claim or update own by child"
  on public.tasks for update
  to authenticated
  using (
    not public.is_parent()
    and (status = 'open' or claimed_by = auth.uid())
  )
  with check (
    not public.is_parent()
    and claimed_by = auth.uid()
  );

-- Usuwanie: tylko rodzic.
create policy "tasks delete by parent"
  on public.tasks for delete
  to authenticated
  using (public.is_parent());

-- ─── submissions ───────────────────────────────────────────────
-- Dziecko widzi i tworzy własne zgłoszenia; rodzic widzi/ocenia wszystkie.
create policy "submissions visible to owner or parent"
  on public.submissions for select
  to authenticated
  using (child_id = auth.uid() or public.is_parent());

create policy "submissions insert by owning child"
  on public.submissions for insert
  to authenticated
  with check (child_id = auth.uid() and not public.is_parent());

-- Ocena zgłoszeń: tylko rodzic.
create policy "submissions review by parent"
  on public.submissions for update
  to authenticated
  using (public.is_parent())
  with check (public.is_parent());

-- ─── task_comments ─────────────────────────────────────────────
-- Wszyscy zalogowani czytają komentarze; autor może dodać własny.
create policy "comments readable by authenticated"
  on public.task_comments for select
  to authenticated
  using (true);

create policy "comments insert by author"
  on public.task_comments for insert
  to authenticated
  with check (user_id = auth.uid());

-- ─── coin_transactions ─────────────────────────────────────────
-- Reguła #8: dziecko widzi TYLKO swoje transakcje; rodzic widzi wszystkich.
create policy "transactions visible to owner or parent"
  on public.coin_transactions for select
  to authenticated
  using (child_id = auth.uid() or public.is_parent());

-- Tworzenie transakcji: tylko rodzic (przyznanie monet, korekta).
-- Wypłaty realizowane przez funkcję transakcyjną (service role).
create policy "transactions insert by parent"
  on public.coin_transactions for insert
  to authenticated
  with check (public.is_parent());

-- ─── withdrawal_requests ───────────────────────────────────────
-- Reguła #8: dziecko widzi tylko swoje prośby; rodzic widzi wszystkie.
create policy "withdrawals visible to owner or parent"
  on public.withdrawal_requests for select
  to authenticated
  using (child_id = auth.uid() or public.is_parent());

-- Dziecko składa własną prośbę o wypłatę.
create policy "withdrawals insert by owning child"
  on public.withdrawal_requests for insert
  to authenticated
  with check (child_id = auth.uid() and not public.is_parent());

-- Rozpatrzenie/oznaczenie "Zapłacono": tylko rodzic.
create policy "withdrawals update by parent"
  on public.withdrawal_requests for update
  to authenticated
  using (public.is_parent())
  with check (public.is_parent());
