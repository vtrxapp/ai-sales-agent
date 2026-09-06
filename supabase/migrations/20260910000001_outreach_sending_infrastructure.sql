-- Zviko Growth Engine - Phase 5: Actual Outreach Infrastructure
-- Adds outreach_send_attempts (a draft can have several - retries never
-- create a new draft) and business-level suppression (Do Not Contact).
-- Sending itself lives entirely in application code behind the
-- OutreachProvider abstraction; this migration only adds the storage and
-- concurrency safeguards the send pipeline depends on.

-- Additive only - existing DRAFT/NEEDS_REVIEW/APPROVED/READY_TO_SEND/
-- SENT/CANCELLED values are untouched. SENDING/FAILED complete the
-- lifecycle the Phase 4 report already reserved room for.
alter type public.outreach_draft_status add value 'SENDING';
alter type public.outreach_draft_status add value 'FAILED';

create type public.send_attempt_status as enum ('PENDING', 'SENT', 'FAILED');

create table public.outreach_send_attempts (
  id uuid primary key default gen_random_uuid(),
  outreach_draft_id uuid not null references public.outreach_drafts (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  channel public.outreach_channel not null,
  provider text not null,
  -- The normalized phone/email actually used for this attempt - kept
  -- here (not just derived from the current contact/business row) so
  -- history stays accurate even if the contact's number changes later.
  -- Never a secret - just the destination address.
  recipient_address text not null,
  status public.send_attempt_status not null default 'PENDING',
  provider_message_id text,
  retryable boolean,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outreach_send_attempts_draft_id_idx on public.outreach_send_attempts (outreach_draft_id);
create index outreach_send_attempts_business_id_idx on public.outreach_send_attempts (business_id);
create index outreach_send_attempts_status_idx on public.outreach_send_attempts (status);
create index outreach_send_attempts_attempted_at_idx on public.outreach_send_attempts (attempted_at desc);

-- The idempotency/concurrency safeguard from spec section 41: at most one
-- PENDING attempt may exist per draft at a time. A second concurrent send
-- request's insert fails this constraint instead of racing to send twice -
-- a real database-level guarantee, not just a disabled button in React.
create unique index outreach_send_attempts_one_pending_per_draft
  on public.outreach_send_attempts (outreach_draft_id)
  where status = 'PENDING';

create trigger set_updated_at before update on public.outreach_send_attempts
  for each row execute function public.set_updated_at();

alter table public.outreach_send_attempts enable row level security;

create policy "outreach_send_attempts_select_authenticated" on public.outreach_send_attempts
  for select to authenticated using (true);
create policy "outreach_send_attempts_insert_authenticated" on public.outreach_send_attempts
  for insert to authenticated with check (true);
create policy "outreach_send_attempts_update_authenticated" on public.outreach_send_attempts
  for update to authenticated using (true) with check (true);

-- Business-level suppression (spec section 29-30). Blocking at the
-- business level - not per-contact - is the deliberately safer default:
-- once a business asks not to be contacted, every channel/contact for it
-- is blocked, not just the one that asked.
alter table public.businesses
  add column do_not_contact boolean not null default false,
  add column do_not_contact_reason text,
  add column do_not_contact_at timestamptz;
