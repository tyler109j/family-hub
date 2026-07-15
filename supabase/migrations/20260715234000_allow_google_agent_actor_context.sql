-- Preserve family identity and audit attribution when the Edge Function uses
-- its service role after independently validating a Google OAuth token.

create or replace function private.set_planner_item_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_headers jsonb := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
  agent_email text := lower(nullif(request_headers ->> 'x-family-actor-email', ''));
  agent_user_id uuid := nullif(request_headers ->> 'x-family-actor-id', '')::uuid;
begin
  if tg_op = 'INSERT' then
    if auth.role() = 'service_role'
       and new.created_via = 'chatgpt'
       and agent_email is not null
       and agent_user_id is not null then
      select fa.household_id
      into new.household_id
      from private.family_access as fa
      where fa.email = agent_email
      order by fa.created_at
      limit 1;

      if new.household_id is null then
        raise exception 'The agent account is not a family member.';
      end if;

      new.created_by := agent_user_id;
      new.created_by_email := agent_email;
    else
      new.household_id := private.current_household_id();
      new.created_by := auth.uid();
      new.created_by_email := private.jwt_email();
    end if;

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
  request_headers jsonb := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
  activity_household_id uuid;
  activity_item_id uuid;
  activity_actor_user_id uuid;
  activity_actor_email text;
  activity_title text;
  activity_operation text;
  activity_source text;
  activity_before jsonb;
  activity_after jsonb;
begin
  if auth.role() = 'service_role' then
    activity_actor_user_id := nullif(request_headers ->> 'x-family-actor-id', '')::uuid;
    activity_actor_email := lower(nullif(request_headers ->> 'x-family-actor-email', ''));
  else
    activity_actor_user_id := auth.uid();
    activity_actor_email := private.jwt_email();
  end if;

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
    activity_actor_user_id,
    activity_actor_email,
    activity_operation,
    activity_source,
    activity_operation || ': ' || activity_title,
    activity_before,
    activity_after
  );

  return coalesce(new, old);
end;
$$;
