-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Kalendarz dyżurów z zastępstwami
-- Rotacja deterministyczna: kolejność w duty_rotation + kotwica 2026-07-02 (poz. 0).
-- Dyżur wyłącznie informacyjny (bez zadań/monet).
-- Mirror rotacji w TS: src/lib/duty/rotation.ts — utrzymywać zgodność.
-- ─────────────────────────────────────────────────────────────────

-- Kolejność rotacji (seedowana w scripts/seed-family.ts po utworzeniu użytkowników).
create table public.duty_rotation (
  position   smallint primary key,       -- 0,1,2
  child_id   uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Wyjątki od rotacji (np. skutek zamiany). Jedna data = jeden dyżurny.
create table public.duty_overrides (
  duty_date  date primary key,
  child_id   uuid not null references public.app_users(id),
  source     text not null default 'swap' check (source in ('swap','manual')),
  created_at timestamptz not null default now()
);

-- Prośby o zastępstwo dla konkretnej daty.
create table public.duty_swap_requests (
  id           uuid primary key default gen_random_uuid(),
  duty_date    date not null,
  requester_id uuid not null references public.app_users(id),
  status       text not null default 'pending' check (status in ('pending','accepted','cancelled')),
  accepted_by  uuid references public.app_users(id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- Co najwyżej jedna aktywna (pending) prośba na dany dzień.
create unique index duty_swap_one_pending_per_date
  on public.duty_swap_requests(duty_date)
  where status = 'pending';

create index duty_swap_requests_status_idx on public.duty_swap_requests(status);

-- ─── RLS ───────────────────────────────────────────────────────
-- Odczyt dla wszystkich zalogowanych (dzieci muszą widzieć u siebie zaproszenie).
-- Zapisy wyłącznie przez RPC SECURITY DEFINER (poniżej) — brak polityk INSERT/UPDATE dla klienta.
alter table public.duty_rotation      enable row level security;
alter table public.duty_overrides     enable row level security;
alter table public.duty_swap_requests enable row level security;

create policy "duty_rotation readable by authenticated"
  on public.duty_rotation for select to authenticated using (true);

create policy "duty_overrides readable by authenticated"
  on public.duty_overrides for select to authenticated using (true);

create policy "duty_swap_requests readable by authenticated"
  on public.duty_swap_requests for select to authenticated using (true);

-- ─── duty_on: efektywny dyżurny dla daty ───────────────────────
-- Mirror algorytmu z src/lib/duty/rotation.ts (kotwica + ((diff%3)+3)%3).
create or replace function public.duty_on(p_date date)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select child_id from public.duty_overrides where duty_date = p_date),
    (select child_id from public.duty_rotation
      where position = (((p_date - date '2026-07-02') % 3) + 3) % 3)
  );
$$;

-- ─── duty_calendar: n kolejnych dni od p_from ──────────────────
create or replace function public.duty_calendar(p_from date, p_days int)
returns table(duty_date date, child_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select d::date as duty_date, public.duty_on(d::date) as child_id
  from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as d;
$$;

-- ─── request_duty_swap ─────────────────────────────────────────
-- Dziecko na dyżurze p_duty_date prosi siostry o zastępstwo.
create or replace function public.request_duty_swap(p_duty_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_req_id uuid;
begin
  if public.is_parent() then
    raise exception 'Rodzic nie pełni dyżurów';
  end if;
  if p_duty_date < v_today then
    raise exception 'Nie można prosić o zastępstwo za miniony dzień';
  end if;
  if public.duty_on(p_duty_date) <> v_uid then
    raise exception 'To nie jest Twój dyżur';
  end if;
  if exists (
    select 1 from public.duty_swap_requests
    where duty_date = p_duty_date and status = 'pending'
  ) then
    raise exception 'Prośba o zastępstwo na ten dzień już istnieje';
  end if;

  insert into public.duty_swap_requests (duty_date, requester_id, status)
  values (p_duty_date, v_uid, 'pending')
  returning id into v_req_id;

  return v_req_id;
end;
$$;

-- ─── accept_duty_swap ──────────────────────────────────────────
-- „Kto pierwszy, ten bierze". Akceptująca bierze dzień prośby; prosząca
-- oddaje najbliższy przyszły dyżur akceptującej (zamiana dwóch dni).
create or replace function public.accept_duty_swap(p_request_id uuid)
returns table(swap_date date, given_back_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.duty_swap_requests;
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_cursor date;
  v_next date := null;
  i int;
begin
  if public.is_parent() then
    raise exception 'Rodzic nie pełni dyżurów';
  end if;

  select * into v_req from public.duty_swap_requests where id = p_request_id for update;
  if not found then raise exception 'Prośba nie istnieje'; end if;
  if v_req.status <> 'pending' then
    raise exception 'Prośba została już rozpatrzona';
  end if;
  if v_req.requester_id = v_uid then
    raise exception 'Nie możesz przyjąć własnej prośby';
  end if;

  -- Najbliższy przyszły dyżur akceptującej (uwzględnia istniejące override'y).
  for i in 1..90 loop
    v_cursor := v_req.duty_date + i;
    if v_cursor > v_today and public.duty_on(v_cursor) = v_uid then
      v_next := v_cursor;
      exit;
    end if;
  end loop;
  if v_next is null then
    raise exception 'Nie znaleziono dyżuru do oddania';
  end if;

  -- Zamiana dwóch dni.
  insert into public.duty_overrides (duty_date, child_id, source)
  values (v_req.duty_date, v_uid, 'swap')
  on conflict (duty_date) do update set child_id = excluded.child_id, source = 'swap';

  insert into public.duty_overrides (duty_date, child_id, source)
  values (v_next, v_req.requester_id, 'swap')
  on conflict (duty_date) do update set child_id = excluded.child_id, source = 'swap';

  update public.duty_swap_requests
     set status = 'accepted', accepted_by = v_uid, resolved_at = now()
   where id = p_request_id;

  swap_date := v_req.duty_date;
  given_back_date := v_next;
  return next;
end;
$$;

-- ─── cancel_duty_swap ──────────────────────────────────────────
create or replace function public.cancel_duty_swap(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.duty_swap_requests;
begin
  select * into v_req from public.duty_swap_requests where id = p_request_id for update;
  if not found then raise exception 'Prośba nie istnieje'; end if;
  if v_req.requester_id <> v_uid then
    raise exception 'Możesz anulować tylko własną prośbę';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Prośba została już rozpatrzona';
  end if;

  update public.duty_swap_requests
     set status = 'cancelled', resolved_at = now()
   where id = p_request_id;
end;
$$;
