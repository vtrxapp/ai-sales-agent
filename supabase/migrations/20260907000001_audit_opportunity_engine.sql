-- Zviko Growth Engine - Phase 3: Website Audit & Opportunity Engine
-- Adds website_audits (append-only history) and expands opportunities
-- into a full, explainable, deduplicated engine.

create type public.audit_status as enum (
  'COMPLETED',
  'NO_WEBSITE',
  'UNREACHABLE',
  'INVALID_URL',
  'FAILED'
);

create type public.audit_category as enum (
  'TECHNICAL',
  'MOBILE',
  'UX',
  'ACCESSIBILITY',
  'SEO',
  'CONTENT',
  'CONVERSION',
  'FUNCTIONALITY'
);

create type public.opportunity_complexity as enum ('LOW', 'MEDIUM', 'HIGH');

-- Opportunity priority gains CRITICAL (spec: CRITICAL/HIGH/MEDIUM/LOW).
-- Existing values are untouched - additive only.
alter type public.opportunity_priority add value 'CRITICAL';

-- website_audits: append-only history, like business_research_notes.
-- Multiple audits over time let the UI show score changes and newly
-- discovered/resolved issues (spec section 19).
create table public.website_audits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  website_url text,
  audit_status public.audit_status not null,
  technical_score smallint check (technical_score between 0 and 100),
  mobile_score smallint check (mobile_score between 0 and 100),
  ux_score smallint check (ux_score between 0 and 100),
  accessibility_score smallint check (accessibility_score between 0 and 100),
  seo_score smallint check (seo_score between 0 and 100),
  content_score smallint check (content_score between 0 and 100),
  conversion_score smallint check (conversion_score between 0 and 100),
  functionality_score smallint check (functionality_score between 0 and 100),
  overall_score smallint check (overall_score between 0 and 100),
  observed_issues jsonb not null default '[]'::jsonb,
  inferred_issues jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  access_notes text,
  source_urls jsonb not null default '[]'::jsonb,
  confidence numeric(3, 2),
  model text not null,
  audited_by uuid references public.profiles (id) on delete set null,
  audited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index website_audits_business_id_idx on public.website_audits (business_id);
create index website_audits_audited_at_idx on public.website_audits (audited_at desc);
create index website_audits_audited_by_idx on public.website_audits (audited_by);

create trigger set_updated_at before update on public.website_audits
  for each row execute function public.set_updated_at();

alter table public.website_audits enable row level security;

create policy "website_audits_select_authenticated" on public.website_audits
  for select to authenticated using (true);
create policy "website_audits_insert_authenticated" on public.website_audits
  for insert to authenticated with check (true);

-- Expand opportunities into a full, explainable, deduplicated engine.
alter table public.opportunities
  add column evidence text,
  add column recommended_service text,
  add column expected_benefit text,
  add column estimated_complexity public.opportunity_complexity,
  add column title_normalized text,
  add column last_detected_at timestamptz not null default now(),
  add column times_detected integer not null default 1,
  add column score smallint check (score between 0 and 100),
  add column business_impact_score smallint check (business_impact_score between 0 and 25),
  add column evidence_strength_score smallint check (evidence_strength_score between 0 and 20),
  add column customer_need_score smallint check (customer_need_score between 0 and 15),
  add column commercial_fit_score smallint check (commercial_fit_score between 0 and 15),
  add column urgency_score smallint check (urgency_score between 0 and 10),
  add column feasibility_score smallint check (feasibility_score between 0 and 15),
  add column score_reasoning jsonb not null default '{}'::jsonb,
  add column audit_id uuid references public.website_audits (id) on delete set null;

-- Backfill title_normalized for the (currently zero) existing rows, then
-- enforce it going forward - safe because the table has no rows yet.
update public.opportunities set title_normalized = lower(trim(title)) where title_normalized is null;
alter table public.opportunities alter column title_normalized set not null;

create index opportunities_title_normalized_idx on public.opportunities (business_id, opportunity_type, title_normalized);
create index opportunities_score_idx on public.opportunities (score desc);
create index opportunities_audit_id_idx on public.opportunities (audit_id);

-- Recreate opportunity_status to match the spec exactly
-- (IDENTIFIED/QUALIFIED/PRESENTED/ACCEPTED/REJECTED/CLOSED). Safe: the
-- table has zero rows at the time of this migration (verified before
-- writing it), so there is no data to preserve or convert.
alter table public.opportunities alter column status drop default;
alter table public.opportunities alter column status type text using status::text;
drop type public.opportunity_status;
create type public.opportunity_status as enum (
  'IDENTIFIED',
  'QUALIFIED',
  'PRESENTED',
  'ACCEPTED',
  'REJECTED',
  'CLOSED'
);
alter table public.opportunities
  alter column status type public.opportunity_status using status::public.opportunity_status,
  alter column status set default 'IDENTIFIED';
