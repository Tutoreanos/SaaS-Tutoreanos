create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid not null,
  kind text not null default 'action' check (kind in ('action', 'deliverable', 'milestone')),
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text,
  board_status text not null default 'backlog' check (board_status in ('backlog', 'planned', 'in_progress', 'waiting', 'done')),
  owner_name text,
  due_date date,
  completed_at timestamptz,
  blocked boolean not null default false,
  block_reason text,
  gut_gravity smallint check (gut_gravity between 1 and 5),
  gut_urgency smallint check (gut_urgency between 1 and 5),
  gut_tendency smallint check (gut_tendency between 1 and 5),
  gut_score smallint generated always as (
    case
      when gut_gravity is not null and gut_urgency is not null and gut_tendency is not null
        then gut_gravity * gut_urgency * gut_tendency
      else null
    end
  ) stored,
  position integer not null default 1000 check (position >= 0),
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint project_items_program_owner_fk
    foreign key (program_id, user_id) references public.consulting_programs(id, user_id) on delete cascade,
  constraint project_items_block_reason_check
    check (not blocked or nullif(trim(block_reason), '') is not null)
);

create index project_items_program_owner_idx
  on public.project_items (program_id, user_id);

create index project_items_board_order_idx
  on public.project_items (user_id, program_id, board_status, position, created_at);

create index project_items_overdue_idx
  on public.project_items (user_id, due_date)
  where due_date is not null and board_status <> 'done';

create index project_items_gut_score_idx
  on public.project_items (user_id, program_id, gut_score desc)
  where gut_score is not null;

create trigger set_project_items_updated_at
before update on public.project_items
for each row execute function public.set_updated_at();

alter table public.project_items enable row level security;

create policy "project_items_select_own"
on public.project_items for select to authenticated
using ((select auth.uid()) = user_id);

create policy "project_items_insert_own"
on public.project_items for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "project_items_update_own"
on public.project_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "project_items_delete_own"
on public.project_items for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.project_items from anon;
grant select, insert, update, delete on table public.project_items to authenticated;
grant select, insert, update, delete on table public.project_items to service_role;
