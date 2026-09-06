-- outreach_send_attempts must be a self-contained historical record per
-- the spec's immutable-history requirement ("message, recipient, sender,
-- channel, timestamp, provider, provider message ID, status, error
-- info") - it must not depend on the mutable outreach_drafts row (whose
-- body/subject can legitimately be edited before a *later* draft is
-- sent) to know what was actually sent. Snapshot the exact approved
-- content and the sending identity at the moment of the attempt.
alter table public.outreach_send_attempts
  add column message_body text not null,
  add column message_subject text,
  add column sender_identity text not null;
