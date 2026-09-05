-- Zviko Growth Engine - Phase 2: Zviko Labs Lead Engine schema
-- businesses, contacts, business_research_notes, lead_scores, opportunities.
-- Same model as Phase 1: authenticated-only RLS, no anon/public access.

create type public.whatsapp_status as enum ('AVAILABLE', 'NOT_AVAILABLE', 'UNKNOWN');

create type public.contact_verification_status as enum ('VERIFIED', 'UNVERIFIED', 'UNKNOWN');

create type public.pipeline_status as enum (
  'NEW',
  'QUALIFIED',
  'CONTACTED',
  'REPLIED',
  'MEETING',
  'PROPOSAL',
  'WON',
  'LOST'
);

create type public.lead_classification as enum (
  'EXCEPTIONAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'VERY_LOW'
);

create type public.opportunity_type as enum (
  'WEBSITE_REDESIGN',
  'WEBSITE_DEVELOPMENT',
  'MOBILE_APP',
  'BOOKING_SYSTEM',
  'ECOMMERCE',
  'CUSTOMER_PORTAL',
  'UI_UX_REDESIGN',
  'AUTOMATION',
  'AI_INTEGRATION',
  'DASHBOARD',
  'CUSTOM_SOFTWARE',
  'OTHER'
);

create type public.opportunity_priority as enum ('HIGH', 'MEDIUM', 'LOW');

create type public.opportunity_status as enum ('IDENTIFIED', 'PROPOSED', 'ACCEPTED', 'REJECTED');

-- businesses: the prospect record. "Leads" (discovery) and "Prospects"
-- (CRM/pipeline) both operate on this same table.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text not null,
  industry text,
  description text,
  location text,
  city text,
  country text,
  website text,
  website_normalized text,
  phone text,
  phone_normalized text,
  whatsapp_number text,
  whatsapp_status public.whatsapp_status not null default 'UNKNOWN',
  email text,
  social_links jsonb not null default '{}'::jsonb,
  pipeline_status public.pipeline_status not null default 'NEW',
  source text not null,
  source_url text,
  discovered_at timestamptz not null default now(),
  last_researched_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_name_normalized_idx on public.businesses (name_normalized);
create index businesses_website_normalized_idx on public.businesses (website_normalized);
create index businesses_phone_normalized_idx on public.businesses (phone_normalized);
create index businesses_pipeline_status_idx on public.businesses (pipeline_status);
create index businesses_industry_idx on public.businesses (industry);
create index businesses_city_idx on public.businesses (city);
create index businesses_discovered_at_idx on public.businesses (discovered_at desc);

create trigger set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- contacts: people at a business. Never invent names/titles - see LeadResearchService.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  job_title text,
  email text,
  phone text,
  whatsapp_number text,
  whatsapp_status public.whatsapp_status not null default 'UNKNOWN',
  social_url text,
  source text not null,
  verification_status public.contact_verification_status not null default 'UNKNOWN',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_business_id_idx on public.contacts (business_id);

create trigger set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- business_research_notes: append-only history of each AI research run.
-- Re-researching creates a new row rather than overwriting - see
-- LeadResearchService and the Activity Timeline requirement.
create table public.business_research_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  observations jsonb not null default '[]'::jsonb,
  inferences jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  digital_presence jsonb not null default '{}'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  confidence numeric(3, 2),
  model text not null,
  researched_by uuid references public.profiles (id) on delete set null,
  researched_at timestamptz not null default now()
);

create index business_research_notes_business_id_idx on public.business_research_notes (business_id);
create index business_research_notes_researched_at_idx on public.business_research_notes (researched_at desc);

-- lead_scores: one current, explainable score per business. Re-scoring
-- updates this row in place; the change is logged to activities.
create table public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  industry_fit_score smallint not null check (industry_fit_score between 0 and 20),
  digital_problems_score smallint not null check (digital_problems_score between 0 and 20),
  missing_functionality_score smallint not null check (missing_functionality_score between 0 and 20),
  business_potential_score smallint not null check (business_potential_score between 0 and 15),
  contactability_score smallint not null check (contactability_score between 0 and 10),
  growth_potential_score smallint not null check (growth_potential_score between 0 and 10),
  other_score smallint not null check (other_score between 0 and 5),
  total_score smallint not null check (total_score between 0 and 100),
  classification public.lead_classification not null,
  reasoning jsonb not null default '{}'::jsonb,
  confidence numeric(3, 2),
  model text not null,
  scored_by uuid references public.profiles (id) on delete set null,
  scored_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_scores_total_score_idx on public.lead_scores (total_score desc);
create index lead_scores_classification_idx on public.lead_scores (classification);

create trigger set_updated_at before update on public.lead_scores
  for each row execute function public.set_updated_at();

-- opportunities: Phase 2 foundation only (Phase 3 expands this).
-- estimated_value is intentionally nullable and never AI-populated - no
-- pricing is invented without configured pricing rules (later phase).
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  opportunity_type public.opportunity_type not null,
  title text not null,
  description text,
  problem text,
  proposed_solution text,
  estimated_value numeric(12, 2),
  priority public.opportunity_priority not null default 'MEDIUM',
  confidence numeric(3, 2),
  status public.opportunity_status not null default 'IDENTIFIED',
  source text not null default 'manual',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_estimated_value_check check (estimated_value is null or estimated_value >= 0)
);

create index opportunities_business_id_idx on public.opportunities (business_id);
create index opportunities_status_idx on public.opportunities (status);

create trigger set_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();

-- Row Level Security: same internal-tool-only model as Phase 1.
alter table public.businesses enable row level security;
alter table public.contacts enable row level security;
alter table public.business_research_notes enable row level security;
alter table public.lead_scores enable row level security;
alter table public.opportunities enable row level security;

create policy "businesses_select_authenticated" on public.businesses
  for select to authenticated using (true);
create policy "businesses_insert_authenticated" on public.businesses
  for insert to authenticated with check (true);
create policy "businesses_update_authenticated" on public.businesses
  for update to authenticated using (true);

create policy "contacts_select_authenticated" on public.contacts
  for select to authenticated using (true);
create policy "contacts_insert_authenticated" on public.contacts
  for insert to authenticated with check (true);
create policy "contacts_update_authenticated" on public.contacts
  for update to authenticated using (true);

create policy "business_research_notes_select_authenticated" on public.business_research_notes
  for select to authenticated using (true);
create policy "business_research_notes_insert_authenticated" on public.business_research_notes
  for insert to authenticated with check (true);

create policy "lead_scores_select_authenticated" on public.lead_scores
  for select to authenticated using (true);
create policy "lead_scores_insert_authenticated" on public.lead_scores
  for insert to authenticated with check (true);
create policy "lead_scores_update_authenticated" on public.lead_scores
  for update to authenticated using (true);

create policy "opportunities_select_authenticated" on public.opportunities
  for select to authenticated using (true);
create policy "opportunities_insert_authenticated" on public.opportunities
  for insert to authenticated with check (true);
create policy "opportunities_update_authenticated" on public.opportunities
  for update to authenticated using (true);
