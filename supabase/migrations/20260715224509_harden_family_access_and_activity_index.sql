create policy "no direct family access reads"
on private.family_access
as restrictive
for all
to authenticated
using (false)
with check (false);

create index agent_activity_item_id_idx
on public.agent_activity_log (item_id)
where item_id is not null;
