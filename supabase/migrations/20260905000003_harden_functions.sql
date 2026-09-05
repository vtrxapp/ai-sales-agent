-- Pin search_path on the trigger function (lint: function_search_path_mutable).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user only runs as an auth.users trigger (SECURITY DEFINER
-- means it always executes with the definer's rights regardless of who
-- fires the trigger, so revoking direct EXECUTE does not break sign-up).
-- Postgres grants EXECUTE to the PUBLIC pseudo-role at CREATE FUNCTION
-- time, which anon/authenticated inherit - revoke from PUBLIC itself
-- (lint: anon/authenticated_security_definer_function_executable).
revoke execute on function public.handle_new_user() from public;
