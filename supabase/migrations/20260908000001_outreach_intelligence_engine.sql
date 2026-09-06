-- Zviko Growth Engine - Phase 4: Outreach Intelligence Engine
-- Adds sales_strategies and outreach_drafts. This phase generates and
-- validates draft messages for human review only - nothing here ever
-- sends anything (no SENT status is ever written by application code;
-- it exists in the enum for Phase 5, which owns actual delivery).

create type public.evidence_type as enum ('OBSERVED', 'INFERRED');

create type public.recommended_channel as enum ('WHATSAPP', 'EMAIL', 'NONE');

create type public.outreach_channel as enum ('WHATSAPP', 'EMAIL');

create type public.outreach_variant as enum ('RECOMMENDED', 'DIRECT', 'CONVERSATIONAL');

-- Single value today (this phase only generates initial outreach); the
-- column exists so a later phase (follow-ups, re-engagement) can add
-- values without a schema change.
create type public.outreach_message_type as enum ('INITIAL_OUTREACH');

create type public.validation_status as enum ('PASSED', 'FAILED');

-- A sales strategy is superseded (never deleted) when a fresh one is
-- generated for the same business+opportunity - same "append-only
-- history" philosophy as website_audits/opportunities.
create type public.sales_strategy_status as enum ('ACTIVE', 'SUPERSEDED');

-- Full future lifecycle per spec. Phase 4 code only ever writes
-- DRAFT/NEEDS_REVIEW/APPROVED/READY_TO_SEND/CANCELLED - never SENT
-- (actually sending is Phase 5's job).
create type public.outreach_draft_status as enum (
  'DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'READY_TO_SEND', 'SENT', 'CANCELLED'
);

create table public.sales_strategies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  target_contact_id uuid references public.contacts (id) on delete set null,
  primary_problem text not null,
  supporting_evidence text not null,
  evidence_type public.evidence_type not null,
  why_it_matters text not null,
  recommended_service text not null,
  recommended_solution text not null,
  expected_business_benefit text not null,
  sales_angle text not null,
  value_proposition text not null,
  recommended_channel public.recommended_channel not null,
  contact_reason text not null,
  opening_strategy text not null,
  objection_considerations jsonb not null default '[]'::jsonb,
  things_to_avoid jsonb not null default '[]'::jsonb,
  confidence numeric(3, 2),
  priority public.opportunity_priority not null,
  status public.sales_strategy_status not null default 'ACTIVE',
  model text not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_strategies_business_id_idx on public.sales_strategies (business_id);
create index sales_strategies_opportunity_id_idx on public.sales_strategies (opportunity_id);
create index sales_strategies_status_idx on public.sales_strategies (status);

create trigger set_updated_at before update on public.sales_strategies
  for each row execute function public.set_updated_at();

alter table public.sales_strategies enable row level security;

create policy "sales_strategies_select_authenticated" on public.sales_strategies
  for select to authenticated using (true);
create policy "sales_strategies_insert_authenticated" on public.sales_strategies
  for insert to authenticated with check (true);
create policy "sales_strategies_update_authenticated" on public.sales_strategies
  for update to authenticated using (true) with check (true);

create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  sales_strategy_id uuid not null references public.sales_strategies (id) on delete cascade,
  channel public.outreach_channel not null,
  message_type public.outreach_message_type not null default 'INITIAL_OUTREACH',
  variant public.outreach_variant not null,
  subject text,
  body text not null,
  personalization_score smallint check (personalization_score between 0 and 100),
  personalization_reasoning jsonb not null default '{}'::jsonb,
  validation_status public.validation_status not null,
  validation_errors jsonb not null default '[]'::jsonb,
  status public.outreach_draft_status not null default 'DRAFT',
  is_user_edited boolean not null default false,
  model text not null,
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outreach_drafts_business_id_idx on public.outreach_drafts (business_id);
create index outreach_drafts_opportunity_id_idx on public.outreach_drafts (opportunity_id);
create index outreach_drafts_sales_strategy_id_idx on public.outreach_drafts (sales_strategy_id);
create index outreach_drafts_status_idx on public.outreach_drafts (status);
create index outreach_drafts_channel_idx on public.outreach_drafts (channel);

create trigger set_updated_at before update on public.outreach_drafts
  for each row execute function public.set_updated_at();

alter table public.outreach_drafts enable row level security;

create policy "outreach_drafts_select_authenticated" on public.outreach_drafts
  for select to authenticated using (true);
create policy "outreach_drafts_insert_authenticated" on public.outreach_drafts
  for insert to authenticated with check (true);
create policy "outreach_drafts_update_authenticated" on public.outreach_drafts
  for update to authenticated using (true) with check (true);
