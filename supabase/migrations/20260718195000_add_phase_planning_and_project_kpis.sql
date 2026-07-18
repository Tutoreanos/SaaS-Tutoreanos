alter table public.project_items
  add column phase_index smallint check (phase_index is null or phase_index >= 0);

create index project_items_phase_idx
  on public.project_items (user_id, program_id, phase_index, board_status)
  where phase_index is not null;

create table public.project_kpis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid not null,
  preset_key text,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  category text not null default 'personalizado',
  unit text not null default 'number' check (unit in ('number', 'percent', 'currency', 'days', 'hours', 'score')),
  direction text not null default 'increase' check (direction in ('increase', 'decrease', 'maintain')),
  baseline_value numeric(16,4) not null default 0,
  current_value numeric(16,4) not null default 0,
  target_value numeric(16,4) not null default 0,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly')),
  active boolean not null default true,
  last_measured_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint project_kpis_program_owner_fk
    foreign key (program_id, user_id) references public.consulting_programs(id, user_id) on delete cascade
);

create unique index project_kpis_preset_unique_idx
  on public.project_kpis (program_id, user_id, preset_key)
  where preset_key is not null;

create index project_kpis_program_owner_idx
  on public.project_kpis (program_id, user_id, active);

create table public.kpi_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kpi_id uuid not null,
  value numeric(16,4) not null,
  measured_at date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  unique (kpi_id, measured_at),
  constraint kpi_measurements_kpi_owner_fk
    foreign key (kpi_id, user_id) references public.project_kpis(id, user_id) on delete cascade
);

create index kpi_measurements_kpi_owner_date_idx
  on public.kpi_measurements (kpi_id, user_id, measured_at desc);

create trigger set_project_kpis_updated_at
before update on public.project_kpis
for each row execute function public.set_updated_at();

alter table public.project_kpis enable row level security;
alter table public.kpi_measurements enable row level security;

create policy "project_kpis_select_own"
on public.project_kpis for select to authenticated
using ((select auth.uid()) = user_id);

create policy "project_kpis_insert_own"
on public.project_kpis for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "project_kpis_update_own"
on public.project_kpis for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "project_kpis_delete_own"
on public.project_kpis for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "kpi_measurements_select_own"
on public.kpi_measurements for select to authenticated
using ((select auth.uid()) = user_id);

create policy "kpi_measurements_insert_own"
on public.kpi_measurements for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "kpi_measurements_update_own"
on public.kpi_measurements for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "kpi_measurements_delete_own"
on public.kpi_measurements for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.project_kpis from anon;
revoke all on table public.kpi_measurements from anon;

grant select, insert, update, delete on table public.project_kpis to authenticated;
grant select, insert, update, delete on table public.kpi_measurements to authenticated;

grant select, insert, update, delete on table public.project_kpis to service_role;
grant select, insert, update, delete on table public.kpi_measurements to service_role;
