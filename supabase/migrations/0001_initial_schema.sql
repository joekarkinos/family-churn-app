-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Initial Schema
-- ─────────────────────────────────────────────────────────────────

-- Users (extends Supabase auth.users)
create table public.app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        text not null check (role in ('parent', 'child')),
  avatar_emoji text not null default '👤',
  coin_balance integer not null default 0,
  bank_account_encrypted text,  -- encrypted, last 4 stored separately
  bank_account_last4 text,
  created_at  timestamptz not null default now()
);

-- Task templates (seeded separately)
create table public.task_templates (
  id              text primary key,
  title           text not null,
  description     text,
  emoji           text not null default '📋',
  default_coins   integer not null default 20,
  default_difficulty text not null default 'medium' check (default_difficulty in ('easy','medium','hard')),
  suggested_checklist jsonb not null default '[]',
  room            text,
  created_at      timestamptz not null default now()
);

-- Tasks
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  emoji           text not null default '📋',
  photo_url       text,          -- zdjęcie dołączone przez rodzica
  template_id     text references public.task_templates(id),
  created_by      uuid not null references public.app_users(id),
  assigned_to     uuid references public.app_users(id),  -- null = ktokolwiek
  coins_reward    integer not null,
  difficulty      text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  expires_at      timestamptz not null,
  deadline_type   text not null check (deadline_type in ('end_of_day','week','custom')),
  status          text not null default 'open' check (status in ('open','claimed','in_review','done','expired')),
  requires_photo_proof boolean not null default false,
  claimed_by      uuid references public.app_users(id),
  claimed_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- Submissions (zgłoszenia wykonania)
create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  child_id        uuid not null references public.app_users(id),
  photo_url       text,
  note            text,
  submitted_at    timestamptz not null default now(),
  reviewed_at     timestamptz,
  review_status   text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  parent_feedback text,
  bonus_coins     integer default 0
);

-- Task comments (dlaczego nikt nie wziął)
create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.app_users(id),
  reason      text check (reason in ('too_hard','too_little_coins','unclear','no_time','other')),
  text        text,
  created_at  timestamptz not null default now()
);

-- Coin transactions
create table public.coin_transactions (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.app_users(id),
  amount      integer not null,  -- positive = earned, negative = spent
  type        text not null check (type in ('earned','withdrawn','bonus','adjusted')),
  task_id     uuid references public.tasks(id),
  note        text,
  created_at  timestamptz not null default now()
);

-- Withdrawal requests (prośby o wypłatę)
create table public.withdrawal_requests (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references public.app_users(id),
  amount_coins    integer not null,
  amount_pln      numeric(10,2) not null,  -- 1:1
  status          text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  requested_at    timestamptz not null default now(),
  paid_at         timestamptz,
  paid_by         uuid references public.app_users(id),
  parent_note     text
);

-- ─── Indexes ───────────────────────────────────────────────────
create index tasks_status_idx on public.tasks(status);
create index tasks_assigned_idx on public.tasks(assigned_to);
create index tasks_expires_idx on public.tasks(expires_at);
create index submissions_task_idx on public.submissions(task_id);
create index submissions_child_idx on public.submissions(child_id);
create index coin_tx_child_idx on public.coin_transactions(child_id);
create index withdrawal_child_idx on public.withdrawal_requests(child_id);

-- ─── RLS (Row Level Security) ─────────────────────────────────
alter table public.app_users enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.task_comments enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Parents see everything; children see their own data
-- Detailed RLS policies to be added in migration 0002
