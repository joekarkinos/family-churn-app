-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Funkcje transakcyjne (RPC)
-- Operacje wielotabelowe muszą być atomowe (reguła #1: 1 moneta = 1 PLN).
-- ─────────────────────────────────────────────────────────────────

-- ─── claim_task ────────────────────────────────────────────────
-- Dziecko przyjmuje otwarte zadanie. Atomowo, by uniknąć wyścigu
-- (reguła #2: 1 zadanie = 1 wykonawca).
create or replace function public.claim_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_task public.tasks;
begin
  if exists (select 1 from public.app_users where id = v_uid and role = 'parent') then
    raise exception 'Rodzic nie może przyjmować zadań';
  end if;

  update public.tasks
     set status     = 'claimed',
         claimed_by  = v_uid,
         claimed_at  = now()
   where id = p_task_id
     and status = 'open'
  returning * into v_task;

  if not found then
    raise exception 'Zadanie zostało już przyjęte lub nie istnieje';
  end if;

  return v_task;
end;
$$;

-- ─── approve_submission ────────────────────────────────────────
-- Rodzic zatwierdza zgłoszenie: oznacza zadanie jako wykonane,
-- przyznaje monety (reward + bonus) i dopisuje transakcję — atomowo.
create or replace function public.approve_submission(
  p_submission_id uuid,
  p_bonus_coins   integer default 0,
  p_feedback      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_sub    public.submissions;
  v_task   public.tasks;
  v_total  integer;
begin
  if not exists (select 1 from public.app_users where id = v_uid and role = 'parent') then
    raise exception 'Tylko rodzic może zatwierdzać zgłoszenia';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'Zgłoszenie nie istnieje'; end if;
  if v_sub.review_status <> 'pending' then
    raise exception 'Zgłoszenie zostało już rozpatrzone';
  end if;

  select * into v_task from public.tasks where id = v_sub.task_id for update;
  v_total := v_task.coins_reward + coalesce(p_bonus_coins, 0);

  update public.submissions
     set review_status   = 'approved',
         reviewed_at      = now(),
         parent_feedback  = p_feedback,
         bonus_coins      = coalesce(p_bonus_coins, 0)
   where id = p_submission_id;

  update public.tasks
     set status = 'done'
   where id = v_sub.task_id;

  insert into public.coin_transactions (child_id, amount, type, task_id, note)
  values (
    v_sub.child_id,
    v_total,
    case when coalesce(p_bonus_coins,0) > 0 then 'bonus' else 'earned' end,
    v_sub.task_id,
    'Zatwierdzono: ' || v_task.title
  );

  update public.app_users
     set coin_balance = coin_balance + v_total
   where id = v_sub.child_id;
end;
$$;

-- ─── reject_submission ─────────────────────────────────────────
-- Rodzic odrzuca zgłoszenie; zadanie wraca do stanu 'claimed'
-- (dziecko może poprawić i zgłosić ponownie). Bez przyznania monet.
create or replace function public.reject_submission(
  p_submission_id uuid,
  p_feedback      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions;
begin
  if not exists (select 1 from public.app_users where id = v_uid and role = 'parent') then
    raise exception 'Tylko rodzic może odrzucać zgłoszenia';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'Zgłoszenie nie istnieje'; end if;
  if v_sub.review_status <> 'pending' then
    raise exception 'Zgłoszenie zostało już rozpatrzone';
  end if;

  update public.submissions
     set review_status  = 'rejected',
         reviewed_at     = now(),
         parent_feedback = p_feedback
   where id = p_submission_id;

  update public.tasks
     set status = 'claimed'
   where id = v_sub.task_id;
end;
$$;

-- ─── request_withdrawal ────────────────────────────────────────
-- Dziecko prosi o wypłatę. Reguła #5: minimum 1 moneta.
-- Nie może przekroczyć salda. Monety "rezerwujemy" dopiero przy wypłacie.
create or replace function public.request_withdrawal(p_amount_coins integer)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
  v_req public.withdrawal_requests;
begin
  if exists (select 1 from public.app_users where id = v_uid and role = 'parent') then
    raise exception 'Rodzic nie składa próśb o wypłatę';
  end if;
  if p_amount_coins < 1 then
    raise exception 'Minimalna wypłata to 1 moneta';
  end if;

  select coin_balance into v_balance from public.app_users where id = v_uid;
  if p_amount_coins > v_balance then
    raise exception 'Niewystarczające saldo (% monet)', v_balance;
  end if;

  insert into public.withdrawal_requests (child_id, amount_coins, amount_pln, status)
  values (v_uid, p_amount_coins, p_amount_coins::numeric, 'pending')
  returning * into v_req;

  return v_req;
end;
$$;

-- ─── mark_withdrawal_paid ──────────────────────────────────────
-- Rodzic oznacza wypłatę jako zapłaconą (po przelewie w Millennium, reguła #6):
-- pomniejsza saldo dziecka i dopisuje transakcję ujemną — atomowo.
create or replace function public.mark_withdrawal_paid(
  p_withdrawal_id uuid,
  p_note          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.withdrawal_requests;
begin
  if not exists (select 1 from public.app_users where id = v_uid and role = 'parent') then
    raise exception 'Tylko rodzic może realizować wypłaty';
  end if;

  select * into v_req from public.withdrawal_requests where id = p_withdrawal_id for update;
  if not found then raise exception 'Prośba o wypłatę nie istnieje'; end if;
  if v_req.status = 'paid' then raise exception 'Wypłata została już zrealizowana'; end if;

  if v_req.amount_coins > (select coin_balance from public.app_users where id = v_req.child_id) then
    raise exception 'Saldo dziecka jest niewystarczające';
  end if;

  update public.withdrawal_requests
     set status      = 'paid',
         paid_at      = now(),
         paid_by      = v_uid,
         parent_note  = p_note
   where id = p_withdrawal_id;

  insert into public.coin_transactions (child_id, amount, type, note)
  values (v_req.child_id, -v_req.amount_coins, 'withdrawn',
          'Wypłata ' || v_req.amount_pln || ' PLN');

  update public.app_users
     set coin_balance = coin_balance - v_req.amount_coins
   where id = v_req.child_id;
end;
$$;
