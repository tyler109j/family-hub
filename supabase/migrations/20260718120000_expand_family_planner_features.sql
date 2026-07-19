alter table public.planner_items
  drop constraint if exists planner_items_item_type_check;

alter table public.planner_items
  add constraint planner_items_item_type_check
  check (
    item_type in (
      'calendar',
      'task',
      'shopping',
      'meal',
      'note',
      'routine',
      'reminder',
      'appointment',
      'maintenance',
      'bill',
      'activity',
      'list'
    )
  );

create index if not exists planner_items_household_recurrence_idx
  on public.planner_items (household_id, (details ->> 'recurrence'))
  where details ? 'recurrence';

comment on column public.planner_items.details is
  'Type-specific planner data including recurrence, routine steps and completion history, reminders, locations, bill details, and shared-list entries.';

