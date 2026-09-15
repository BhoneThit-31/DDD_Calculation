-- DDD Calculation: multi-tenant 3-digit dealer POS foundation
-- Authentication is handled by Supabase Auth. No email column is required by the app.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  phone text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dealers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  shop_name text not null,
  phone text,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dealer_members (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  unique (dealer_id, user_id)
);

create table public.draw_periods (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  draw_date date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'result_entered', 'settled')),
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date),
  check (draw_date between start_date and end_date)
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  name text not null,
  phone text,
  commission_percent numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  default_payout_rate numeric(8,2) not null default 80 check (default_payout_rate >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rule_definitions (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  code text not null,
  name_mm text not null,
  aliases text[] not null default '{}',
  rule_type text not null,
  config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealer_id, code)
);

create table public.commission_limits (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  draw_period_id uuid not null references public.draw_periods(id) on delete cascade,
  rule_type text not null,
  max_amount numeric(14,2) not null check (max_amount >= 0),
  warning_percent numeric(5,2) not null default 80 check (warning_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commission_id, draw_period_id, rule_type)
);

create table public.number_limits (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  draw_period_id uuid not null references public.draw_periods(id) on delete cascade,
  number text not null check (number ~ '^[0-9]{3}$'),
  max_amount numeric(14,2) not null check (max_amount >= 0),
  warning_percent numeric(5,2) not null default 80 check (warning_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commission_id, draw_period_id, number)
);

create table public.sales_entries (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  commission_id uuid not null references public.commissions(id),
  draw_period_id uuid not null references public.draw_periods(id),
  receipt_number integer not null,
  raw_input text not null,
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealer_id, receipt_number)
);

create table public.sales_items (
  id uuid primary key default gen_random_uuid(),
  sales_entry_id uuid not null references public.sales_entries(id) on delete cascade,
  number text not null check (number ~ '^[0-9]{3}$'),
  rule_type text not null,
  amount numeric(14,2) not null check (amount >= 0),
  payout_rate numeric(8,2),
  source_text text,
  created_at timestamptz not null default now()
);

create table public.winning_results (
  id uuid primary key default gen_random_uuid(),
  draw_period_id uuid not null unique references public.draw_periods(id) on delete cascade,
  winning_number text not null check (winning_number ~ '^[0-9]{3}$'),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index draw_periods_dealer_dates_idx on public.draw_periods (dealer_id, start_date desc, end_date desc);
create index commissions_dealer_idx on public.commissions (dealer_id, created_at desc);
create index sales_entries_period_idx on public.sales_entries (dealer_id, draw_period_id, created_at desc);
create index sales_entries_commission_idx on public.sales_entries (commission_id, draw_period_id, created_at desc);
create index sales_items_number_idx on public.sales_items (number);
create index audit_logs_entity_idx on public.audit_logs (dealer_id, entity_type, entity_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, phone, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || left(replace(new.id::text, '-', ''), 12)),
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_dealer_member(target_dealer_id uuid)
returns boolean
language sql
security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.dealer_members
    where dealer_id = target_dealer_id and user_id = auth.uid()
  ) or exists (
    select 1 from public.dealers
    where id = target_dealer_id and owner_user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.dealers enable row level security;
alter table public.dealer_members enable row level security;
alter table public.draw_periods enable row level security;
alter table public.commissions enable row level security;
alter table public.rule_definitions enable row level security;
alter table public.commission_limits enable row level security;
alter table public.number_limits enable row level security;
alter table public.sales_entries enable row level security;
alter table public.sales_items enable row level security;
alter table public.winning_results enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy dealers_member_select on public.dealers for select using (public.is_dealer_member(id));
create policy dealers_owner_insert on public.dealers for insert with check (owner_user_id = auth.uid());
create policy dealers_owner_update on public.dealers for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy members_member_select on public.dealer_members for select using (public.is_dealer_member(dealer_id));
create policy members_owner_insert on public.dealer_members for insert with check (
  exists (select 1 from public.dealers d where d.id = dealer_id and d.owner_user_id = auth.uid())
);
create policy members_owner_update on public.dealer_members for update using (
  exists (select 1 from public.dealers d where d.id = dealer_id and d.owner_user_id = auth.uid())
);

create policy draw_periods_member_all on public.draw_periods for all using (public.is_dealer_member(dealer_id)) with check (public.is_dealer_member(dealer_id));
create policy commissions_member_all on public.commissions for all using (public.is_dealer_member(dealer_id)) with check (public.is_dealer_member(dealer_id));
create policy rules_member_all on public.rule_definitions for all using (public.is_dealer_member(dealer_id)) with check (public.is_dealer_member(dealer_id));

create policy commission_limits_member_all on public.commission_limits for all using (
  exists (select 1 from public.commissions c where c.id = commission_id and public.is_dealer_member(c.dealer_id))
) with check (
  exists (select 1 from public.commissions c where c.id = commission_id and public.is_dealer_member(c.dealer_id))
);

create policy number_limits_member_all on public.number_limits for all using (
  exists (select 1 from public.commissions c where c.id = commission_id and public.is_dealer_member(c.dealer_id))
) with check (
  exists (select 1 from public.commissions c where c.id = commission_id and public.is_dealer_member(c.dealer_id))
);

create policy sales_entries_member_all on public.sales_entries for all using (public.is_dealer_member(dealer_id)) with check (public.is_dealer_member(dealer_id));
create policy sales_items_member_all on public.sales_items for all using (
  exists (select 1 from public.sales_entries e where e.id = sales_entry_id and public.is_dealer_member(e.dealer_id))
) with check (
  exists (select 1 from public.sales_entries e where e.id = sales_entry_id and public.is_dealer_member(e.dealer_id))
);

create policy winners_member_all on public.winning_results for all using (
  exists (select 1 from public.draw_periods p where p.id = draw_period_id and public.is_dealer_member(p.dealer_id))
) with check (
  exists (select 1 from public.draw_periods p where p.id = draw_period_id and public.is_dealer_member(p.dealer_id))
);

create policy audit_member_select on public.audit_logs for select using (public.is_dealer_member(dealer_id));
create policy audit_member_insert on public.audit_logs for insert with check (public.is_dealer_member(dealer_id) and created_by = auth.uid());
