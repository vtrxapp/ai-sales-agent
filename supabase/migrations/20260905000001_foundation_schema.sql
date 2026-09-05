-- Zviko Growth Engine - Phase 1: Foundation schema
-- profiles, products, campaigns, activities + RLS.
-- Internal tool: no public signup. Every table is authenticated-only.

create type public.product_type as enum ('ZVIKO_LABS', 'DATING_APP');

create type public.campaign_type as enum (
  'CLIENT_ACQUISITION',
  'USER_ACQUISITION',
  'SIGNATURE_COLLECTION',
  'BRAND_AWARENESS',
  'CONTENT',
  'PARTNERSHIP',
  'REFERRAL'
);

create type public.campaign_status as enum (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED'
);

-- profiles: one row per internal team member, created automatically
-- when an account is added in Supabase Auth (see handle_new_user below).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  type public.product_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  name text not null,
  description text,
  campaign_type public.campaign_type not null,
  objective text,
  status public.campaign_status not null default 'DRAFT',
  target_location text,
  target_audience text,
  start_date date,
  end_date date,
  budget numeric(12, 2),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_dates_check check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  constraint campaigns_budget_check check (budget is null or budget >= 0)
);

create index campaigns_product_id_idx on public.campaigns (product_id);
create index campaigns_status_idx on public.campaigns (status);

-- activities: append-only activity timeline shown on the dashboard.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  activity_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index activities_product_id_idx on public.activities (product_id);
create index activities_campaign_id_idx on public.activities (campaign_id);
create index activities_created_at_idx on public.activities (created_at desc);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- auto-create a profile row when a team member is added in Supabase Auth
-- (Dashboard > Authentication > Add user / Invite). There is no public
-- signup route in the application itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: internal tool, no public/anon access anywhere.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.campaigns enable row level security;
alter table public.activities enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

create policy "products_select_authenticated" on public.products
  for select to authenticated using (true);
create policy "products_insert_authenticated" on public.products
  for insert to authenticated with check (true);
create policy "products_update_authenticated" on public.products
  for update to authenticated using (true);

create policy "campaigns_select_authenticated" on public.campaigns
  for select to authenticated using (true);
create policy "campaigns_insert_authenticated" on public.campaigns
  for insert to authenticated with check (true);
create policy "campaigns_update_authenticated" on public.campaigns
  for update to authenticated using (true);

create policy "activities_select_authenticated" on public.activities
  for select to authenticated using (true);
create policy "activities_insert_authenticated" on public.activities
  for insert to authenticated with check (true);
