-- Zviko Growth Engine - Phase 6: Response Tracking & Sales Intelligence
-- Adds conversation/inbound-message tracking, response classification,
-- and links back to the existing Phase 5 outreach_send_attempts for a
-- unified timeline. Reuses outreach_channel (WHATSAPP|EMAIL) rather than
-- inventing a parallel channel enum.

create type public.conversation_status as enum (
  'OPEN', 'WAITING_FOR_US', 'WAITING_FOR_THEM', 'CLOSED', 'DO_NOT_CONTACT'
);

create type public.response_intent as enum (
  'INTERESTED', 'QUESTION', 'REQUEST_FOR_PRICING', 'REQUEST_FOR_MEETING',
  'OBJECTION', 'NOT_INTERESTED', 'WRONG_PERSON', 'OPT_OUT',
  'POSITIVE_GENERAL', 'NEGATIVE_GENERAL', 'UNCLEAR'
);

create type public.response_sentiment as enum ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

create type public.response_urgency as enum ('HIGH', 'MEDIUM', 'LOW');

create type public.response_sales_stage as enum (
  'INITIAL_RESPONSE', 'QUALIFICATION', 'DISCOVERY', 'MEETING_REQUEST',
  'PRICING', 'PROPOSAL_DISCUSSION', 'CLOSED_WON', 'CLOSED_LOST', 'UNKNOWN'
);

create type public.message_processing_status as enum ('PENDING', 'MATCHED', 'UNMATCHED', 'ERROR');

create type public.message_classification_status as enum ('PENDING', 'CLASSIFIED', 'SKIPPED', 'FAILED');

-- One conversation per (business, channel) - deliberately business-level,
-- not per-contact, matching the same simplification Phase 5 made for
-- Do Not Contact. contact_id is stored for display/reference only.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  channel public.outreach_channel not null,
  provider text not null,
  external_conversation_id text,
  status public.conversation_status not null default 'OPEN',
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, channel)
);

create index conversations_business_id_idx on public.conversations (business_id);
create index conversations_status_idx on public.conversations (status);
create index conversations_last_message_at_idx on public.conversations (last_message_at desc);

create trigger set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
create policy "conversations_select_authenticated" on public.conversations for select to authenticated using (true);
create policy "conversations_insert_authenticated" on public.conversations for insert to authenticated with check (true);
create policy "conversations_update_authenticated" on public.conversations for update to authenticated using (true) with check (true);

-- Append-only (message_body/sender_identifier/received_at are never
-- rewritten once stored); classification_*/processing_status/
-- recommended_action columns are populated after insert, which is
-- metadata about the message rather than a rewrite of what was said.
-- business_id/contact_id/conversation_id are nullable because an
-- unmatched inbound message is stored with none of them set rather
-- than ever being attached to a guessed/wrong business (spec section 9).
create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  channel public.outreach_channel not null,
  provider text not null,
  external_message_id text not null,
  external_conversation_id text,
  direction text not null default 'INBOUND' check (direction = 'INBOUND'),
  message_body text not null,
  sender_identifier text not null,
  recipient_identifier text not null,
  received_at timestamptz not null,
  raw_type text,
  metadata jsonb not null default '{}'::jsonb,
  processing_status public.message_processing_status not null default 'PENDING',
  classification_status public.message_classification_status not null default 'PENDING',
  intent public.response_intent,
  sentiment public.response_sentiment,
  urgency public.response_urgency,
  sales_stage public.response_sales_stage,
  classification_confidence numeric,
  classification_reasoning jsonb not null default '{}'::jsonb,
  classification_model text,
  classified_at timestamptz,
  recommended_action text,
  recommended_action_reason text,
  created_at timestamptz not null default now(),
  unique (provider, external_message_id)
);

create index inbound_messages_conversation_id_idx on public.inbound_messages (conversation_id);
create index inbound_messages_business_id_idx on public.inbound_messages (business_id);
create index inbound_messages_processing_status_idx on public.inbound_messages (processing_status);
create index inbound_messages_received_at_idx on public.inbound_messages (received_at desc);

alter table public.inbound_messages enable row level security;
create policy "inbound_messages_select_authenticated" on public.inbound_messages for select to authenticated using (true);
create policy "inbound_messages_insert_authenticated" on public.inbound_messages for insert to authenticated with check (true);
create policy "inbound_messages_update_authenticated" on public.inbound_messages for update to authenticated using (true) with check (true);

-- Links an existing Phase 5 send attempt into a conversation's timeline
-- instead of a second outbound-message table (spec section 6). Nullable:
-- the initial outreach send predates any conversation; it's backfilled
-- once the first reply creates one.
alter table public.outreach_send_attempts
  add column conversation_id uuid references public.conversations (id) on delete set null;

create index outreach_send_attempts_conversation_id_idx on public.outreach_send_attempts (conversation_id);
