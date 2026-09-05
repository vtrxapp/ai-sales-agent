-- Cover FKs used for "who did this" lookups.
create index activities_actor_id_idx on public.activities (actor_id);
create index campaigns_created_by_idx on public.campaigns (created_by);

-- Avoid per-row re-evaluation of auth.uid() in RLS (wrap in a scalar subquery).
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid()));
