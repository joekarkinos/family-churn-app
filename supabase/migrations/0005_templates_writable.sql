-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Szablony edytowalne przez rodzica
-- Dodaje polityki RLS (insert/update/delete) tylko dla rodzica oraz
-- zmienia FK tasks.template_id na ON DELETE SET NULL (zachowaj zadania,
-- odłącz szablon).
-- ─────────────────────────────────────────────────────────────────

-- Zapis szablonów: tylko rodzic (select pozostaje z migracji 0002).
create policy "templates insert by parent"
  on public.task_templates for insert
  to authenticated
  with check (public.is_parent());

create policy "templates update by parent"
  on public.task_templates for update
  to authenticated
  using (public.is_parent())
  with check (public.is_parent());

create policy "templates delete by parent"
  on public.task_templates for delete
  to authenticated
  using (public.is_parent());

-- FK: usunięcie szablonu zostawia zadania, zeruje template_id.
-- Nazwa domyślnego constraintu nadawana przez Postgres to
-- tasks_template_id_fkey (table_column_fkey).
alter table public.tasks
  drop constraint tasks_template_id_fkey;

alter table public.tasks
  add constraint tasks_template_id_fkey
  foreign key (template_id) references public.task_templates(id)
  on delete set null;
