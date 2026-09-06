-- Zviko Growth Engine - Phase 6.1: AI Draft Response & Human-Approved Follow-up
-- Extends the existing outreach_drafts/outreach_send_attempts pipeline to
-- also carry AI-drafted replies within a conversation, rather than
-- building a second messaging system. A response draft is an
-- outreach_drafts row like any other - same validation, same approval,
-- same send path - distinguished only by message_type = 'RESPONSE' and
-- the two new linking columns below.

alter type public.outreach_message_type add value 'RESPONSE';

alter table public.outreach_drafts
  add column conversation_id uuid references public.conversations (id) on delete set null,
  add column response_to_message_id uuid references public.inbound_messages (id) on delete set null,
  add column rationale text;

create index outreach_drafts_conversation_id_idx on public.outreach_drafts (conversation_id);
create index outreach_drafts_response_to_message_id_idx on public.outreach_drafts (response_to_message_id);

-- outreach_send_attempts already has conversation_id (added in Phase 6)
-- but nothing populated it at send time - only the one-time backfill in
-- findOrCreateConversation did. Now that outreach_drafts itself carries
-- conversation_id for a response draft, sendOutreachMessage propagates it
-- onto the attempt row directly, so a sent response appears in the
-- conversation timeline immediately rather than depending on a future
-- backfill that will never run again for this conversation.
