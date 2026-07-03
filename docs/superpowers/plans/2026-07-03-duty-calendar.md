# Kalendarz dyżurów z zastępstwami — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać kalendarz dyżurów trzech córek (Sonia→Hania→Maria, rotacja co dzień) z banerem „Dziś Twój dyżur" na ekranie głównym dziecka oraz mechanizmem zastępstwa (prośba do sióstr + automatyczna zamiana dwóch dni po akceptacji).

**Architecture:** Rotacja jest deterministyczna (stała kolejność z tabeli `duty_rotation` + data-kotwica). Logika rotacji istnieje w DWÓCH miejscach celowo: (1) czysta funkcja TS `src/lib/duty/rotation.ts` — używana do wyświetlania (baner, mini-kalendarz) i pokryta testami jednostkowymi; (2) mirror w SQL (`duty_on`) — źródło prawdy dla walidacji w RPC. Wyjątki od rotacji trzyma tabela `duty_overrides`; prośby o zastępstwo — `duty_swap_requests`. Wszystkie mutacje idą przez RPC `SECURITY DEFINER` (jak istniejące `claim_task`, `approve_submission`).

**Tech Stack:** Next.js 14 App Router (Server Components + server actions), TypeScript, Supabase (Postgres + RLS + RPC), Tailwind, `date-fns-tz` (już w zależnościach), `react-hot-toast`, testy jednostkowe przez wbudowany `node --test` + `tsx` (brak nowych zależności).

## Global Constraints

- Język UI/komunikatów/błędów: **wyłącznie polski** (CLAUDE.md → Design).
- Strefa czasowa dla „dziś" i dat dyżuru: **Europe/Warsaw** (spójnie z regułą deadline 23:59).
- Kolejność rotacji: `['Sonia', 'Hania', 'Maria']`; data-kotwica `2026-07-02` = Sonia (pozycja 0).
- Dyżur jest **wyłącznie informacyjny** — nie tworzy zadań ani monet.
- Zamiana: „kto pierwszy, ten bierze"; automatyczna zamiana dnia dzisiejszego z **najbliższym przyszłym dyżurem akceptującej**.
- Server Components domyślnie; `'use client'` tylko gdy konieczne (CLAUDE.md → Konwencje).
- Supabase queries: zawsze obsługa błędów, nigdy `.data!` bez sprawdzenia.
- Commity bez podpisu GPG: używać `git -c commit.gpgsign=false commit` (pamięć projektu). Autor: joekarkinos <karkinos79@gmail.com>.
- Nowe typy w `src/types/index.ts`, eksportowane.

## Mapa plików

- **Create** `supabase/migrations/0006_duty_calendar.sql` — tabele `duty_rotation`, `duty_overrides`, `duty_swap_requests`, RLS, funkcje `duty_on`, `duty_calendar`, RPC `request_duty_swap`, `accept_duty_swap`, `cancel_duty_swap`.
- **Create** `supabase/tests/0006_duty_checks.sql` — asercje SQL (DO/RAISE) sprawdzające rotację względem zaseedowanych dzieci.
- **Modify** `scripts/seed-family.ts` — po utworzeniu użytkowników upsert 3 wierszy `duty_rotation` (Sonia=0, Hania=1, Maria=2).
- **Create** `src/lib/duty/rotation.ts` — czyste funkcje rotacji (index, efektywny dyżurny, kalendarz) na stringach dat `YYYY-MM-DD`.
- **Create** `src/lib/duty/rotation.test.ts` — testy jednostkowe rotacji (`node --test`).
- **Create** `src/lib/duty/queries.ts` — serwerowy loader danych dyżuru + wyznaczenie stanu banera dla zalogowanego dziecka.
- **Create** `src/app/(child)/duty-actions.ts` — server actions: `requestDutySwap`, `acceptDutySwap`, `cancelDutySwap`.
- **Create** `src/components/duty/DutyBanner.tsx` — `'use client'`, interaktywny baner (prośba / anulowanie / akceptacja).
- **Create** `src/components/duty/DutyWeek.tsx` — server component, read-only lista najbliższych ~5 dni.
- **Modify** `src/types/index.ts` — typy `DutyRotationRow`, `DutyOverride`, `DutySwapRequest`, `DutyDay`, `DutyBannerState`.
- **Modify** `src/app/(child)/zadania/page.tsx` — render `<DutyBanner>` + `<DutyWeek>` nad listą zadań.
- **Modify** `package.json` — skrypt `test`.

---

### Task 1: Czysta funkcja rotacji (TS) + testy

Najtrudniejsza logika (modulo z ujemnymi, kotwica, mapowanie index→dziecko). Implementujemy jako czyste funkcje na stringach dat `YYYY-MM-DD` (bez pułapek stref przy liczeniu różnicy dni), w pełni testowalne bez infrastruktury.

**Files:**
- Create: `src/lib/duty/rotation.ts`
- Test: `src/lib/duty/rotation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nic (moduł bazowy).
- Produces:
  - `ANCHOR_DATE: string` = `'2026-07-02'` (pozycja 0 = Sonia).
  - `dutyIndexForDate(dateStr: string, anchorStr?: string): number` — zwraca 0..2.
  - `effectiveDutyChildId(dateStr: string, rotation: { position: number; child_id: string }[], overrides: { duty_date: string; child_id: string }[], anchorStr?: string): string | null` — override wygrywa; inaczej `rotation` wg indeksu; `null` gdy brak rotacji dla pozycji.
  - `buildDutyCalendar(fromStr: string, days: number, rotation, overrides, anchorStr?): { duty_date: string; child_id: string | null }[]`.
  - `addDaysStr(dateStr: string, days: number): string`, `diffDaysStr(aStr: string, bStr: string): number` (pomocnicze, eksportowane do testów).

- [ ] **Step 1: Write the failing test**

Create `src/lib/duty/rotation.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANCHOR_DATE,
  dutyIndexForDate,
  effectiveDutyChildId,
  buildDutyCalendar,
  addDaysStr,
  diffDaysStr,
} from './rotation'

const ROT = [
  { position: 0, child_id: 'sonia' },
  { position: 1, child_id: 'hania' },
  { position: 2, child_id: 'maria' },
]

test('kotwica ma indeks 0 (Sonia)', () => {
  assert.equal(dutyIndexForDate(ANCHOR_DATE), 0)
})

test('kolejne dni rotują 0,1,2,0', () => {
  assert.equal(dutyIndexForDate('2026-07-02'), 0)
  assert.equal(dutyIndexForDate('2026-07-03'), 1)
  assert.equal(dutyIndexForDate('2026-07-04'), 2)
  assert.equal(dutyIndexForDate('2026-07-05'), 0)
})

test('dzień przed kotwicą używa ujemnego modulo poprawnie', () => {
  // 2026-07-01 = dzień przed Sonią => pozycja 2 (Maria)
  assert.equal(dutyIndexForDate('2026-07-01'), 2)
})

test('effectiveDutyChildId mapuje indeks na dziecko', () => {
  assert.equal(effectiveDutyChildId('2026-07-03', ROT, []), 'hania')
  assert.equal(effectiveDutyChildId('2026-07-04', ROT, []), 'maria')
})

test('override wygrywa z rotacją', () => {
  const ov = [{ duty_date: '2026-07-03', child_id: 'maria' }]
  assert.equal(effectiveDutyChildId('2026-07-03', ROT, ov), 'maria')
})

test('buildDutyCalendar zwraca kolejne dni z uwzględnieniem override', () => {
  const ov = [{ duty_date: '2026-07-04', child_id: 'sonia' }]
  const cal = buildDutyCalendar('2026-07-03', 3, ROT, ov)
  assert.deepEqual(cal, [
    { duty_date: '2026-07-03', child_id: 'hania' },
    { duty_date: '2026-07-04', child_id: 'sonia' }, // override
    { duty_date: '2026-07-05', child_id: 'sonia' }, // rotacja
  ])
})

test('helpery dat', () => {
  assert.equal(addDaysStr('2026-07-03', 2), '2026-07-05')
  assert.equal(addDaysStr('2026-07-31', 1), '2026-08-01')
  assert.equal(diffDaysStr('2026-07-05', '2026-07-02'), 3)
})
```

- [ ] **Step 2: Add test script and run to verify it fails**

Modify `package.json` scripts — add:

```json
    "test": "node --import tsx --test src/lib/duty/rotation.test.ts",
```

Run: `npm test`
Expected: FAIL — `Cannot find module './rotation'` (plik jeszcze nie istnieje).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/duty/rotation.ts`:

```ts
// Rotacja dyżurów — czyste funkcje na stringach dat 'YYYY-MM-DD'.
// UWAGA: to jest referencyjna (i testowana) implementacja rotacji.
// Mirror w SQL: supabase/migrations/0006_duty_calendar.sql → funkcja duty_on().
// Przy zmianie kolejności/kotwicy/algorytmu — zaktualizuj OBA miejsca.

// Pozycja 0 = Sonia (patrz duty_rotation + seed-family.ts). Kotwica: tego dnia dyżur ma pozycja 0.
export const ANCHOR_DATE = '2026-07-02'
const CYCLE = 3

// 'YYYY-MM-DD' -> liczba dni od epoki (UTC midnight), bez pułapek stref.
function toDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

function fromDayNumber(dayNum: number): string {
  const dt = new Date(dayNum * 86_400_000)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function diffDaysStr(aStr: string, bStr: string): number {
  return toDayNumber(aStr) - toDayNumber(bStr)
}

export function addDaysStr(dateStr: string, days: number): string {
  return fromDayNumber(toDayNumber(dateStr) + days)
}

// Indeks rotacji 0..CYCLE-1 (ujemne modulo obsłużone).
export function dutyIndexForDate(dateStr: string, anchorStr: string = ANCHOR_DATE): number {
  const diff = diffDaysStr(dateStr, anchorStr)
  return ((diff % CYCLE) + CYCLE) % CYCLE
}

export function effectiveDutyChildId(
  dateStr: string,
  rotation: { position: number; child_id: string }[],
  overrides: { duty_date: string; child_id: string }[],
  anchorStr: string = ANCHOR_DATE
): string | null {
  const ov = overrides.find((o) => o.duty_date === dateStr)
  if (ov) return ov.child_id
  const idx = dutyIndexForDate(dateStr, anchorStr)
  const row = rotation.find((r) => r.position === idx)
  return row ? row.child_id : null
}

export function buildDutyCalendar(
  fromStr: string,
  days: number,
  rotation: { position: number; child_id: string }[],
  overrides: { duty_date: string; child_id: string }[],
  anchorStr: string = ANCHOR_DATE
): { duty_date: string; child_id: string | null }[] {
  const out: { duty_date: string; child_id: string | null }[] = []
  for (let i = 0; i < days; i++) {
    const duty_date = addDaysStr(fromStr, i)
    out.push({ duty_date, child_id: effectiveDutyChildId(duty_date, rotation, overrides, anchorStr) })
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — wszystkie testy (`tests 7`, `pass 7`, `fail 0`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/duty/rotation.ts src/lib/duty/rotation.test.ts package.json
git -c commit.gpgsign=false commit -m "Dyżury: czysta funkcja rotacji + testy jednostkowe"
```

---

### Task 2: Migracja bazy — tabele, RLS, funkcje i RPC

**Files:**
- Create: `supabase/migrations/0006_duty_calendar.sql`

**Interfaces:**
- Consumes: `public.app_users`, `public.is_parent()` (z 0002).
- Produces (surface RPC dla warstwy TS):
  - `duty_on(p_date date) returns uuid` — efektywny dyżurny (override else rotacja).
  - `duty_calendar(p_from date, p_days int) returns table(duty_date date, child_id uuid)`.
  - `request_duty_swap(p_duty_date date) returns uuid` — zwraca id prośby.
  - `accept_duty_swap(p_request_id uuid) returns table(swap_date date, given_back_date date)`.
  - `cancel_duty_swap(p_request_id uuid) returns void`.
  - Tabela `duty_rotation(position smallint pk, child_id uuid)` — seedowana w Task 3.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_duty_calendar.sql`:

```sql
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
```

- [ ] **Step 2: Apply migration to local Supabase (jeśli dostępne)**

Run: `npx supabase db reset` (odtwarza lokalną bazę ze wszystkich migracji + seed).
Expected: brak błędów SQL; log kończy się `Applying migration 0006_duty_calendar.sql...` bez `ERROR`.

> Jeśli lokalne Supabase/Docker jest niedostępne: pomiń ten krok, ale zweryfikuj składnię przez przejrzenie migracji. Asercje SQL z Task 4 zweryfikują logikę, gdy baza będzie dostępna.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_duty_calendar.sql
git -c commit.gpgsign=false commit -m "Dyżury: migracja — tabele, RLS, funkcje rotacji i RPC zamiany"
```

---

### Task 3: Seed kolejności rotacji

Tabela `duty_rotation` odwołuje się do `app_users.id`, które powstają dopiero przy seedzie rodziny (nie w migracji). Rozszerzamy skrypt seedujący, by po utworzeniu profili zapisał kolejność Sonia=0, Hania=1, Maria=2.

**Files:**
- Modify: `scripts/seed-family.ts`

**Interfaces:**
- Consumes: `admin` (service-role client już utworzony w skrypcie), `FAMILY` (nazwy→profile), tabela `duty_rotation` (z Task 2).
- Produces: 3 wiersze w `duty_rotation`.

- [ ] **Step 1: Zbierz mapę imię→id podczas pętli**

W `scripts/seed-family.ts`, przed pętlą `for (const person of FAMILY)` dodaj:

```ts
  const idByName: Record<string, string> = {}
```

Wewnątrz pętli, tuż po ustaleniu `userId` (po bloku if/else przypisującym `userId`), dodaj:

```ts
    idByName[person.name] = userId
```

- [ ] **Step 2: Upsert duty_rotation po pętli**

Po zakończeniu pętli `for`, a przed `console.log('\n✓ Seed rodziny zakończony.')`, dodaj:

```ts
  // Kolejność dyżurów: Sonia=0, Hania=1, Maria=2 (kotwica 2026-07-02 = poz. 0 = Sonia).
  const ROTATION_ORDER = ['Sonia', 'Hania', 'Maria']
  const rotationRows = ROTATION_ORDER.map((name, position) => {
    const child_id = idByName[name]
    if (!child_id) {
      throw new Error(`Brak zaseedowanego dziecka do rotacji: ${name}`)
    }
    return { position, child_id }
  })
  const { error: rotErr } = await admin
    .from('duty_rotation')
    .upsert(rotationRows, { onConflict: 'position' })
  if (rotErr) throw rotErr
  console.log('• Kolejność dyżurów zapisana: ' + ROTATION_ORDER.join(' → '))
```

- [ ] **Step 3: Uruchom seed (jeśli lokalne Supabase dostępne)**

Run: `npm run seed:family`
Expected: log zawiera `• Kolejność dyżurów zapisana: Sonia → Hania → Maria` i `✓ Seed rodziny zakończony.`

> Jeśli baza niedostępna: pomiń uruchomienie; zweryfikuj przez `npm run type-check` (Task 6 i tak to sprawdzi) i przegląd kodu.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-family.ts
git -c commit.gpgsign=false commit -m "Dyżury: seed kolejności rotacji (Sonia→Hania→Maria)"
```

---

### Task 4: Asercje SQL dla rotacji

Sprawdzają, że `duty_on`/`duty_calendar` zwracają zaseedowane dzieci dla znanych dat. Bez zewnętrznego harnessu — czysty SQL z `RAISE EXCEPTION` (brak wyjątku = sukces). Uruchamiane, gdy lokalna baza jest dostępna.

**Files:**
- Create: `supabase/tests/0006_duty_checks.sql`

**Interfaces:**
- Consumes: `duty_on`, `duty_calendar`, zaseedowane `duty_rotation` + `app_users`.
- Produces: nic (skrypt weryfikacyjny).

- [ ] **Step 1: Write the assertions**

Create `supabase/tests/0006_duty_checks.sql`:

```sql
-- Asercje rotacji dyżurów. Uruchom po migracji 0006 + seedzie:
--   npx supabase db reset && npx supabase db execute --file supabase/tests/0006_duty_checks.sql
-- (lub psql -f ...). Brak wyjątku = wszystkie asercje przeszły.
do $$
declare
  v_sonia uuid := (select id from public.app_users where name = 'Sonia');
  v_hania uuid := (select id from public.app_users where name = 'Hania');
  v_maria uuid := (select id from public.app_users where name = 'Maria');
begin
  if v_sonia is null or v_hania is null or v_maria is null then
    raise exception 'ASERCJA: brak zaseedowanych dzieci (uruchom seed rodziny)';
  end if;

  -- Kotwica i kolejne dni.
  if public.duty_on(date '2026-07-02') <> v_sonia then
    raise exception 'ASERCJA: 2026-07-02 powinno być Sonia';
  end if;
  if public.duty_on(date '2026-07-03') <> v_hania then
    raise exception 'ASERCJA: 2026-07-03 powinno być Hania';
  end if;
  if public.duty_on(date '2026-07-04') <> v_maria then
    raise exception 'ASERCJA: 2026-07-04 powinno być Maria';
  end if;
  if public.duty_on(date '2026-07-05') <> v_sonia then
    raise exception 'ASERCJA: 2026-07-05 powinno być Sonia (cykl)';
  end if;

  -- Dzień przed kotwicą (ujemne modulo) => Maria (poz. 2).
  if public.duty_on(date '2026-07-01') <> v_maria then
    raise exception 'ASERCJA: 2026-07-01 powinno być Maria (ujemne modulo)';
  end if;

  -- duty_calendar zwraca właściwą liczbę dni w kolejności.
  if (select count(*) from public.duty_calendar(date '2026-07-03', 5)) <> 5 then
    raise exception 'ASERCJA: duty_calendar powinno zwrócić 5 dni';
  end if;

  raise notice 'OK: wszystkie asercje rotacji przeszły';
end $$;
```

- [ ] **Step 2: Run assertions (jeśli lokalne Supabase dostępne)**

Run: `npx supabase db execute --file supabase/tests/0006_duty_checks.sql`
Expected: `NOTICE:  OK: wszystkie asercje rotacji przeszły`, brak `ERROR`.

> Jeśli baza niedostępna: pomiń uruchomienie (plik zostaje jako weryfikacja do odpalenia później).

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/0006_duty_checks.sql
git -c commit.gpgsign=false commit -m "Dyżury: asercje SQL rotacji"
```

---

### Task 5: Typy + serwerowy loader danych dyżuru

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/duty/queries.ts`

**Interfaces:**
- Consumes: `createClient` z `@/lib/supabase/server`, `getCurrentUser` z `@/lib/auth/session`, `effectiveDutyChildId`/`buildDutyCalendar` z `@/lib/duty/rotation`.
- Produces:
  - Typy: `DutyRotationRow`, `DutyOverride`, `DutySwapRequest`, `DutyDay`, `DutyBannerState`.
  - `loadDutyView(): Promise<DutyView | null>` gdzie `DutyView = { today: string; currentUserId: string; children: Record<string, {name:string; avatar_emoji:string; color:string|null}>; calendar: DutyDay[]; banner: DutyBannerState }`.

- [ ] **Step 1: Add types**

W `src/types/index.ts`, na końcu pliku dodaj:

```ts
// ─── Dyżury (kalendarz + zastępstwa) ─────────────────────────────

export interface DutyRotationRow {
  position: number
  child_id: string
}

export interface DutyOverride {
  duty_date: string      // 'YYYY-MM-DD'
  child_id: string
  source: 'swap' | 'manual'
}

export type DutySwapStatus = 'pending' | 'accepted' | 'cancelled'

export interface DutySwapRequest {
  id: string
  duty_date: string
  requester_id: string
  status: DutySwapStatus
  accepted_by?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface DutyDay {
  duty_date: string
  child_id: string | null
}

// Stan banera dyżuru dla zalogowanego dziecka na ekranie głównym.
export type DutyBannerState =
  | { kind: 'none' }                                              // brak dyżuru dziś, brak zaproszenia
  | { kind: 'info'; childName: string; childEmoji: string }       // ktoś inny na dyżurze, brak zaproszenia
  | { kind: 'on_duty' }                                           // ja na dyżurze, mogę poprosić
  | { kind: 'awaiting'; requestId: string }                       // ja na dyżurze, czekam na zastępstwo
  | { kind: 'invited'; requestId: string; requesterName: string } // siostra prosi mnie o zastępstwo dziś
```

- [ ] **Step 2: Write the loader**

Create `src/lib/duty/queries.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { formatInTimeZone } from 'date-fns-tz'
import { effectiveDutyChildId, buildDutyCalendar, addDaysStr } from './rotation'
import type {
  DutyRotationRow,
  DutyOverride,
  DutySwapRequest,
  DutyDay,
  DutyBannerState,
} from '@/types'

const TZ = 'Europe/Warsaw'
const CALENDAR_DAYS = 5

export interface DutyView {
  today: string
  currentUserId: string
  children: Record<string, { name: string; avatar_emoji: string; color: string | null }>
  calendar: DutyDay[]
  banner: DutyBannerState
}

// „Dziś" w strefie Europe/Warsaw jako 'YYYY-MM-DD'.
export function warsawToday(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
}

export async function loadDutyView(): Promise<DutyView | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const today = warsawToday()
  const horizonEnd = addDaysStr(today, CALENDAR_DAYS - 1)

  const [rotRes, childRes, ovRes, reqRes] = await Promise.all([
    supabase.from('duty_rotation').select('position, child_id'),
    supabase.from('app_users').select('id, name, avatar_emoji, color').eq('role', 'child'),
    supabase.from('duty_overrides').select('duty_date, child_id, source').gte('duty_date', today).lte('duty_date', horizonEnd),
    supabase.from('duty_swap_requests').select('*').eq('status', 'pending').eq('duty_date', today),
  ])

  if (rotRes.error || childRes.error || ovRes.error || reqRes.error) {
    return null
  }

  const rotation = (rotRes.data ?? []) as DutyRotationRow[]
  const overrides = (ovRes.data ?? []) as DutyOverride[]
  const pending = (reqRes.data ?? []) as DutySwapRequest[]

  const children: DutyView['children'] = {}
  for (const c of childRes.data ?? []) {
    children[c.id] = { name: c.name, avatar_emoji: c.avatar_emoji, color: c.color }
  }

  const calendar = buildDutyCalendar(today, CALENDAR_DAYS, rotation, overrides)
  const todayDutyId = effectiveDutyChildId(today, rotation, overrides)
  const todayRequest = pending[0]

  const banner = computeBanner(user.id, todayDutyId, todayRequest, children)

  return { today, currentUserId: user.id, children, calendar, banner }
}

function computeBanner(
  userId: string,
  todayDutyId: string | null,
  request: DutySwapRequest | undefined,
  children: DutyView['children']
): DutyBannerState {
  const iAmOnDuty = todayDutyId === userId

  if (iAmOnDuty) {
    if (request && request.requester_id === userId) {
      return { kind: 'awaiting', requestId: request.id }
    }
    return { kind: 'on_duty' }
  }

  // Nie ja na dyżurze: jeśli dyżurna siostra prosi o zastępstwo — zaproszenie.
  if (request && request.requester_id !== userId) {
    const requester = children[request.requester_id]
    return {
      kind: 'invited',
      requestId: request.id,
      requesterName: requester?.name ?? 'Siostra',
    }
  }

  if (todayDutyId && children[todayDutyId]) {
    return {
      kind: 'info',
      childName: children[todayDutyId].name,
      childEmoji: children[todayDutyId].avatar_emoji,
    }
  }
  return { kind: 'none' }
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: brak błędów (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/duty/queries.ts
git -c commit.gpgsign=false commit -m "Dyżury: typy + serwerowy loader stanu banera i kalendarza"
```

---

### Task 6: Server actions dla zamiany

**Files:**
- Create: `src/app/(child)/duty-actions.ts`

**Interfaces:**
- Consumes: `createClient` (server), RPC `request_duty_swap`, `accept_duty_swap`, `cancel_duty_swap`.
- Produces:
  - `type DutyActionResult = { ok: true; message?: string } | { ok: false; error: string }`
  - `requestDutySwap(dutyDate: string): Promise<DutyActionResult>`
  - `acceptDutySwap(requestId: string): Promise<DutyActionResult>`
  - `cancelDutySwap(requestId: string): Promise<DutyActionResult>`

- [ ] **Step 1: Write the actions**

Create `src/app/(child)/duty-actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/format'

export type DutyActionResult = { ok: true; message?: string } | { ok: false; error: string }

// Dziecko na dyżurze prosi siostry o zastępstwo (dziś).
export async function requestDutySwap(dutyDate: string): Promise<DutyActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_duty_swap', { p_duty_date: dutyDate })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }
  revalidatePath('/zadania')
  return { ok: true, message: 'Poproszono siostry o zastępstwo' }
}

// Siostra akceptuje zastępstwo (kto pierwszy, ten bierze). Zwraca komunikat o oddanym dniu.
export async function acceptDutySwap(requestId: string): Promise<DutyActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_duty_swap', { p_request_id: requestId })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }
  revalidatePath('/zadania')
  // RPC zwraca setof jednego wiersza (swap_date, given_back_date).
  const row = Array.isArray(data) ? data[0] : data
  const back = row?.given_back_date
  const message = back
    ? `Bierzesz dziś dyżur. Siostra odda Ci dzień ${formatDate(back + 'T00:00:00')}`
    : 'Bierzesz dziś dyżur'
  return { ok: true, message }
}

// Prosząca wycofuje własną prośbę.
export async function cancelDutySwap(requestId: string): Promise<DutyActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_duty_swap', { p_request_id: requestId })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }
  revalidatePath('/zadania')
  return { ok: true, message: 'Anulowano prośbę' }
}

// Komunikaty z RPC już są po polsku; reszta to fallback.
function tłumaczBłąd(msg: string): string {
  if (msg.includes('row-level security')) return 'Brak uprawnień do tej operacji'
  if (msg.includes('duty_swap_one_pending_per_date')) return 'Prośba o zastępstwo na ten dzień już istnieje'
  return msg
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów (exit 0).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(child)/duty-actions.ts"
git -c commit.gpgsign=false commit -m "Dyżury: server actions prośby/akceptacji/anulowania zamiany"
```

---

### Task 7: Komponent DutyBanner (interaktywny)

**Files:**
- Create: `src/components/duty/DutyBanner.tsx`

**Interfaces:**
- Consumes: `DutyBannerState` (typ), server actions z `@/app/(child)/duty-actions`, `warsawToday` nie jest potrzebne (data przychodzi w propsach), `LoadingOverlay`, `react-hot-toast`, `useRouter`.
- Produces: `export function DutyBanner({ state, today }: { state: DutyBannerState; today: string })`.

- [ ] **Step 1: Write the component**

Create `src/components/duty/DutyBanner.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import {
  requestDutySwap,
  acceptDutySwap,
  cancelDutySwap,
  type DutyActionResult,
} from '@/app/(child)/duty-actions'
import type { DutyBannerState } from '@/types'

export function DutyBanner({ state, today }: { state: DutyBannerState; today: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<DutyActionResult>) {
    startTransition(async () => {
      const res = await fn()
      if (res.ok) {
        if (res.message) toast.success(res.message)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  if (state.kind === 'none') return null

  const base = 'mb-4 rounded-2xl p-4 shadow-sm'

  if (state.kind === 'info') {
    return (
      <div className={`${base} bg-surface`}>
        <p className="text-sm text-ink-3">Dziś dyżur pełni</p>
        <p className="font-display text-lg font-bold text-ink">
          {state.childEmoji} {state.childName}
        </p>
      </div>
    )
  }

  if (state.kind === 'on_duty') {
    return (
      <div className={`${base} bg-teal/10 border border-teal/30`}>
        <LoadingOverlay show={pending} />
        <p className="font-display text-lg font-bold text-ink">🧹 Dziś Twój dyżur!</p>
        <p className="mb-3 text-sm text-ink-3">Nie dasz rady? Poproś siostry o zastępstwo.</p>
        <button
          onClick={() => run(() => requestDutySwap(today))}
          disabled={pending}
          className="rounded-full bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Nie mogę dziś — poproś siostry
        </button>
      </div>
    )
  }

  if (state.kind === 'awaiting') {
    return (
      <div className={`${base} bg-surface border border-border`}>
        <LoadingOverlay show={pending} />
        <p className="font-display text-lg font-bold text-ink">⏳ Czekam na zastępstwo…</p>
        <p className="mb-3 text-sm text-ink-3">Poprosiłaś siostry o przejęcie dzisiejszego dyżuru.</p>
        <button
          onClick={() => run(() => cancelDutySwap(state.requestId))}
          disabled={pending}
          className="text-sm font-medium text-teal underline disabled:opacity-60"
        >
          Anuluj prośbę
        </button>
      </div>
    )
  }

  // kind === 'invited'
  return (
    <div className={`${base} bg-teal/10 border border-teal/30`}>
      <LoadingOverlay show={pending} />
      <p className="font-display text-lg font-bold text-ink">🙋 {state.requesterName} prosi o zastępstwo</p>
      <p className="mb-3 text-sm text-ink-3">Jeśli się zgodzisz, weźmiesz dziś dyżur, a ona odda Ci swój najbliższy.</p>
      <button
        onClick={() => run(() => acceptDutySwap(state.requestId))}
        disabled={pending}
        className="rounded-full bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Zgadzam się
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów (exit 0).

> Uwaga: klasy Tailwind (`bg-surface`, `text-ink`, `text-ink-3`, `bg-teal`) są używane w istniejących komponentach — potwierdź obecność w `tailwind.config.ts`/globalnym CSS; jeśli nazwa różni się, użyj tej z istniejących komponentów (np. `TaskCard`).

- [ ] **Step 3: Commit**

```bash
git add src/components/duty/DutyBanner.tsx
git -c commit.gpgsign=false commit -m "Dyżury: interaktywny baner (prośba/akceptacja/anulowanie)"
```

---

### Task 8: Komponent DutyWeek (mini-kalendarz, read-only)

**Files:**
- Create: `src/components/duty/DutyWeek.tsx`

**Interfaces:**
- Consumes: `DutyDay` (typ), mapa dzieci z `DutyView['children']`, `formatInTimeZone` niepotrzebne (daty gotowe), `today` do oznaczenia „dziś".
- Produces: `export function DutyWeek({ calendar, children, today }: { calendar: DutyDay[]; children: Record<string, { name: string; avatar_emoji: string; color: string | null }>; today: string })`.

- [ ] **Step 1: Write the component**

Create `src/components/duty/DutyWeek.tsx`:

```tsx
import type { DutyDay } from '@/types'

const WEEKDAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.']

// 'YYYY-MM-DD' -> etykieta dnia tygodnia (bez pułapek stref: liczymy z UTC midnight).
function weekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function dayNum(dateStr: string): string {
  return String(Number(dateStr.split('-')[2]))
}

export function DutyWeek({
  calendar,
  children,
  today,
}: {
  calendar: DutyDay[]
  children: Record<string, { name: string; avatar_emoji: string; color: string | null }>
  today: string
}) {
  if (calendar.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-medium text-ink-3">Grafik dyżurów</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {calendar.map((day) => {
          const child = day.child_id ? children[day.child_id] : undefined
          const isToday = day.duty_date === today
          return (
            <div
              key={day.duty_date}
              className={
                'flex min-w-[64px] flex-col items-center rounded-xl px-2 py-2 text-center ' +
                (isToday ? 'bg-teal/15 border border-teal/40' : 'bg-surface')
              }
            >
              <span className="text-[11px] text-ink-3">{weekdayLabel(day.duty_date)}</span>
              <span className="text-xs font-medium text-ink">{dayNum(day.duty_date)}</span>
              <span className="mt-1 text-lg" title={child?.name ?? ''}>
                {child?.avatar_emoji ?? '—'}
              </span>
              <span className="text-[11px] text-ink-3">{child?.name ?? ''}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/components/duty/DutyWeek.tsx
git -c commit.gpgsign=false commit -m "Dyżury: mini-kalendarz grafiku (read-only)"
```

---

### Task 9: Osadzenie na ekranie głównym dziecka

**Files:**
- Modify: `src/app/(child)/zadania/page.tsx`

**Interfaces:**
- Consumes: `loadDutyView` z `@/lib/duty/queries`, `DutyBanner`, `DutyWeek`.
- Produces: zaktualizowana strona `/zadania` z banerem + kalendarzem nad listą zadań.

- [ ] **Step 1: Dodaj importy**

W `src/app/(child)/zadania/page.tsx`, po istniejących importach dodaj:

```ts
import { loadDutyView } from '@/lib/duty/queries'
import { DutyBanner } from '@/components/duty/DutyBanner'
import { DutyWeek } from '@/components/duty/DutyWeek'
```

- [ ] **Step 2: Załaduj dane dyżuru w komponencie strony**

W funkcji `ZadaniaPage`, po linii `const supabase = await createClient()` dodaj:

```ts
  const duty = await loadDutyView()
```

- [ ] **Step 3: Wyrenderuj baner + kalendarz nad listą**

W zwracanym JSX, bezpośrednio po zamknięciu `</header>` (a przed blokiem `{error && ...}`), wstaw:

```tsx
      {duty && (
        <>
          <DutyBanner state={duty.banner} today={duty.today} />
          <DutyWeek calendar={duty.calendar} children={duty.children} today={duty.today} />
        </>
      )}
```

- [ ] **Step 4: Type-check + build**

Run: `npm run type-check && npm run build`
Expected: type-check bez błędów; build kończy się sukcesem (`✓ Compiled`), strona `/zadania` w wyniku bez błędów.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(child)/zadania/page.tsx"
git -c commit.gpgsign=false commit -m "Dyżury: baner + grafik na ekranie głównym dziecka"
```

---

### Task 10: Weryfikacja end-to-end + lint

Finalna weryfikacja całości. Uruchom, gdy lokalne Supabase jest dostępne.

**Files:** — (brak zmian; weryfikacja)

- [ ] **Step 1: Lint całości**

Run: `npm run lint`
Expected: brak błędów ESLint.

- [ ] **Step 2: Testy jednostkowe rotacji**

Run: `npm test`
Expected: `pass 7`, `fail 0`.

- [ ] **Step 3: (jeśli baza dostępna) reset + seed + asercje SQL**

```bash
npx supabase db reset
npm run seed:family
npx supabase db execute --file supabase/tests/0006_duty_checks.sql
```
Expected: `NOTICE:  OK: wszystkie asercje rotacji przeszły`.

- [ ] **Step 4: (jeśli baza dostępna) Ręczny scenariusz zamiany**

Kroki (w aplikacji, `npm run dev`):
1. Zaloguj się jako **Hania** (dziś dyżur, 2026-07-03) → baner „🧹 Dziś Twój dyżur!". Kliknij „Nie mogę dziś — poproś siostry" → baner zmienia się na „⏳ Czekam na zastępstwo…".
2. W drugiej sesji zaloguj się jako **Maria** → baner „🙋 Hania prosi o zastępstwo" + „Zgadzam się". Kliknij → toast „Bierzesz dziś dyżur. Siostra odda Ci dzień …".
3. Odśwież: grafik (`DutyWeek`) pokazuje dziś = Maria, a najbliższy dyżur Marii (2026-07-04) = Hania.
4. Zaloguj jako **Sonia** → jej baner nie oferuje już „Zgadzam się" (prośba rozpatrzona) — pokazuje info „Dziś dyżur pełni 👧 Maria".

Expected: zachowanie jak wyżej; brak błędów w konsoli.

- [ ] **Step 5: Final commit (jeśli powstały drobne poprawki)**

```bash
git add -A
git -c commit.gpgsign=false commit -m "Dyżury: weryfikacja end-to-end i poprawki"
```

---

## Self-Review

**Spec coverage:**
- Rotacja Sonia→Hania→Maria, kotwica 07-02 → Task 1 (TS) + Task 2 (SQL) + Task 3 (seed) + Task 4 (asercje). ✅
- Strefa Europe/Warsaw → `warsawToday` (Task 5), `now() at time zone 'Europe/Warsaw'` w RPC (Task 2). ✅
- Override tylko jako wyjątki → tabela `duty_overrides` + `duty_on` coalesce (Task 2), `effectiveDutyChildId` (Task 1). ✅
- „Kto pierwszy, ten bierze" → `accept_duty_swap` z `FOR UPDATE` + `status='pending'` (Task 2). ✅
- Najbliższy przyszły dyżur akceptującej → pętla 1..90 w `accept_duty_swap` (Task 2). ✅
- Baner na ekranie głównym (on_duty / awaiting / invited / info) → `DutyBannerState` (Task 5) + `DutyBanner` (Task 7) + osadzenie (Task 9). ✅
- Mini-kalendarz → `DutyWeek` (Task 8). ✅
- Powiadomienia in-app (bez FCM) → baner/toast; brak zadań FCM. ✅
- Jedna aktywna prośba na dzień → częściowy unikalny indeks (Task 2). ✅
- Anulowanie przez proszącą → `cancel_duty_swap` (Task 2) + `awaiting` (Task 7). ✅

**Placeholder scan:** brak „TBD/TODO"; każdy krok z kodem ma kod; komendy z oczekiwanym wynjściem. Kroki zależne od lokalnej bazy wyraźnie oznaczone jako opcjonalne z podaną alternatywą (type-check/lint/testy jednostkowe zawsze uruchamialne). ✅

**Type consistency:**
- `effectiveDutyChildId`, `buildDutyCalendar`, `addDaysStr` — te same sygnatury w Task 1 (def) i Task 5 (użycie). ✅
- `DutyBannerState` warianty (`none/info/on_duty/awaiting/invited`) — spójne w Task 5 (def), Task 7 (konsumpcja). ✅
- `DutyActionResult` — def w Task 6, import w Task 7. ✅
- RPC nazwy/parametry (`request_duty_swap(p_duty_date)`, `accept_duty_swap(p_request_id)`, `cancel_duty_swap(p_request_id)`) — spójne Task 2 ↔ Task 6. ✅
- `accept_duty_swap` zwraca `setof (swap_date, given_back_date)` — obsłużone w Task 6 (`Array.isArray(data) ? data[0] : data`). ✅

## Poza zakresem (YAGNI)
- FCM push (osobne, niezrobione TODO).
- Ręczna edycja grafiku przez rodzica (`source='manual'` zarezerwowane na później).
- Historia zamian poza wierszami `duty_swap_requests`.
