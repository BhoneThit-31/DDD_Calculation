create table if not exists public.dealer_limits (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  draw_period_id uuid not null references public.draw_periods(id) on delete cascade,
  limit_type text not null check (limit_type in ('all_number', 'number')),
  number text check (number is null or number ~ '^[0-9]{3}$'),
  max_amount numeric(14,2) not null check (max_amount >= 0),
  warning_percent numeric(5,2) not null default 100 check (warning_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((limit_type = 'all_number' and number is null) or (limit_type = 'number' and number is not null)),
  unique (dealer_id, draw_period_id, limit_type, number)
);

create table if not exists public.commission_number_limits (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete cascade,
  draw_period_id uuid not null references public.draw_periods(id) on delete cascade,
  number text not null check (number ~ '^[0-9]{3}$'),
  max_amount numeric(14,2) not null check (max_amount >= 0),
  warning_percent numeric(5,2) not null default 100 check (warning_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commission_id, draw_period_id, number)
);

create index if not exists dealer_limits_scope_idx on public.dealer_limits (dealer_id, draw_period_id, limit_type, number);
create index if not exists commission_number_limits_scope_idx on public.commission_number_limits (dealer_id, draw_period_id, commission_id, number);

alter table public.dealer_limits enable row level security;
alter table public.commission_number_limits enable row level security;
create policy dealer_limits_member_all on public.dealer_limits for all using (public.is_dealer_member(dealer_id)) with check (public.is_dealer_member(dealer_id));
create policy commission_number_limits_member_all on public.commission_number_limits for all using (public.is_dealer_member(dealer_id)) with check (public.is_dealer_member(dealer_id));
