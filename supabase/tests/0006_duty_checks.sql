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
