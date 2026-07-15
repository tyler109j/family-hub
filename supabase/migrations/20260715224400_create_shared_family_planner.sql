create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table private.family_access (
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (email = lower(email)),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  member_role text not null check (member_role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, email)
);

alter table private.family_access enable row level security;
revoke all on table private.family_access from public, anon, authenticated;

create or replace function private.jwt_email()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(nullif(auth.jwt() ->> 'email', ''));
$$;

create or replace function private.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fa.household_id
  from private.family_access as fa
  where (select auth.uid()) is not null
    and fa.email = lower(auth.jwt() ->> 'email')
  order by fa.created_at
  limit 1;
$$;

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from private.family_access as fa
      where fa.household_id = target_household_id
        and fa.email = lower(auth.jwt() ->> 'email')
    );
$$;

revoke all on function private.jwt_email() from public;
revoke all on function private.current_household_id() from public;
revoke all on function private.is_household_member(uuid) from public;
grant execute on function private.jwt_email() to authenticated;
grant execute on function private.current_household_id() to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;

create table public.planner_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households(id) on delete cascade,
  item_type text not null check (item_type in ('calendar', 'task', 'shopping', 'meal', 'note')),
  title text not null check (char_length(trim(title)) between 1 and 300),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  due_at timestamptz,
  planned_for date,
  assignee text,
  created_by uuid not null default auth.uid(),
  created_by_email text not null default private.jwt_email(),
  created_via text not null default 'website' check (created_via in ('website', 'chatgpt', 'system')),
  updated_via text not null default 'website' check (updated_via in ('website', 'chatgpt', 'undo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (created_by_email = lower(created_by_email)),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.agent_activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid references public.planner_items(id) on delete set null,
  actor_user_id uuid,
  actor_email text,
  operation text not null check (operation in ('create', 'update', 'complete', 'cancel', 'delete', 'undo')),
  source text not null check (source in ('website', 'chatgpt', 'system')),
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now(),
  check (actor_email is null or actor_email = lower(actor_email))
);

create index planner_items_household_type_status_idx
  on public.planner_items (household_id, item_type, status);
create index planner_items_household_starts_at_idx
  on public.planner_items (household_id, starts_at)
  where starts_at is not null;
create index planner_items_household_due_at_idx
  on public.planner_items (household_id, due_at)
  where due_at is not null;
create index planner_items_household_planned_for_idx
  on public.planner_items (household_id, planned_for)
  where planned_for is not null;
create index agent_activity_household_created_idx
  on public.agent_activity_log (household_id, created_at desc);
create index agent_activity_actor_created_idx
  on public.agent_activity_log (actor_user_id, created_at desc)
  where actor_user_id is not null;

create or replace function private.set_planner_item_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.household_id := private.current_household_id();
    new.created_by := auth.uid();
    new.created_by_email := private.jwt_email();
    new.created_at := now();
    new.updated_at := now();
    new.updated_via := new.created_via;
  else
    new.household_id := old.household_id;
    new.created_by := old.created_by;
    new.created_by_email := old.created_by_email;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function private.log_planner_item_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  activity_household_id uuid;
  activity_item_id uuid;
  activity_title text;
  activity_operation text;
  activity_source text;
  activity_before jsonb;
  activity_after jsonb;
begin
  if tg_op = 'INSERT' then
    activity_household_id := new.household_id;
    activity_item_id := new.id;
    activity_title := new.title;
    activity_operation := 'create';
    activity_before := null;
    activity_after := to_jsonb(new);
    activity_source := case
      when (auth.jwt() ->> 'client_id') is not null or new.created_via = 'chatgpt' then 'chatgpt'
      when auth.uid() is null then 'system'
      else 'website'
    end;
  elsif tg_op = 'UPDATE' then
    activity_household_id := new.household_id;
    activity_item_id := new.id;
    activity_title := new.title;
    activity_operation := case
      when new.updated_via = 'undo' then 'undo'
      when old.status is distinct from new.status and new.status = 'completed' then 'complete'
      when old.status is distinct from new.status and new.status = 'cancelled' then 'cancel'
      else 'update'
    end;
    activity_before := to_jsonb(old);
    activity_after := to_jsonb(new);
    activity_source := case
      when (auth.jwt() ->> 'client_id') is not null or new.updated_via in ('chatgpt', 'undo') then 'chatgpt'
      when auth.uid() is null then 'system'
      else 'website'
    end;
  else
    activity_household_id := old.household_id;
    activity_item_id := old.id;
    activity_title := old.title;
    activity_operation := 'delete';
    activity_before := to_jsonb(old);
    activity_after := null;
    activity_source := case
      when (auth.jwt() ->> 'client_id') is not null or old.updated_via = 'chatgpt' then 'chatgpt'
      when auth.uid() is null then 'system'
      else 'website'
    end;
  end if;

  insert into public.agent_activity_log (
    household_id,
    item_id,
    actor_user_id,
    actor_email,
    operation,
    source,
    summary,
    before_state,
    after_state
  ) values (
    activity_household_id,
    activity_item_id,
    auth.uid(),
    private.jwt_email(),
    activity_operation,
    activity_source,
    activity_operation || ': ' || activity_title,
    activity_before,
    activity_after
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.set_planner_item_identity() from public;
revoke all on function private.log_planner_item_change() from public;
grant execute on function private.set_planner_item_identity() to authenticated;
grant execute on function private.log_planner_item_change() to authenticated;

create trigger set_planner_item_identity
before insert or update on public.planner_items
for each row execute function private.set_planner_item_identity();

create trigger log_planner_item_change
after insert or update or delete on public.planner_items
for each row execute function private.log_planner_item_change();

alter table public.households enable row level security;
alter table public.planner_items enable row level security;
alter table public.agent_activity_log enable row level security;

create policy "family can read household"
on public.households
for select
to authenticated
using ((select private.is_household_member(id)));

create policy "family can read planner items"
on public.planner_items
for select
to authenticated
using ((select private.is_household_member(household_id)));

create policy "family can create planner items"
on public.planner_items
for insert
to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
  and created_by_email = (select private.jwt_email())
);

create policy "family can update planner items"
on public.planner_items
for update
to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy "family can delete planner items"
on public.planner_items
for delete
to authenticated
using ((select private.is_household_member(household_id)));

create policy "family can read activity history"
on public.agent_activity_log
for select
to authenticated
using ((select private.is_household_member(household_id)));

create policy "family changes can append activity history"
on public.agent_activity_log
for insert
to authenticated
with check (
  (select private.is_household_member(household_id))
  and actor_user_id = (select auth.uid())
  and actor_email = (select private.jwt_email())
);

revoke all on table public.households from anon;
revoke all on table public.planner_items from anon;
revoke all on table public.agent_activity_log from anon;

grant usage on schema public to authenticated;
grant select on table public.households to authenticated;
grant select, insert, update, delete on table public.planner_items to authenticated;
grant select, insert on table public.agent_activity_log to authenticated;

insert into public.households (id, name, timezone)
values ('f1111111-1111-4111-8111-111111111111', 'Tyler & Kayla Family', 'America/New_York');

insert into private.family_access (household_id, email, display_name, member_role)
values
  ('f1111111-1111-4111-8111-111111111111', 'tyler109j@gmail.com', 'Tyler', 'owner'),
  ('f1111111-1111-4111-8111-111111111111', 'kaylajilljoyce@gmail.com', 'Kayla', 'member');

alter publication supabase_realtime add table public.planner_items;
