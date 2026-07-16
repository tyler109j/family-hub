-- The Family Planner Edge Function validates the household API key before
-- using Supabase's server-only service role. Its write triggers need narrowly
-- scoped access to resolve the approved family member and append audit rows.

grant usage on schema private to service_role;
grant select on table private.family_access to service_role;
grant execute on function private.set_planner_item_identity() to service_role;
grant execute on function private.log_planner_item_change() to service_role;
