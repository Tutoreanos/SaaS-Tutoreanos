create table public.units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  franchisee_name text,
  email text,
  phone text,
  city text,
  state text,
  model text not null default 'physical' check (model in ('home_based', 'physical', 'hybrid')),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('planning', 'active', 'paused', 'inactive')),
  health_status text not null default 'no_data' check (health_status in ('no_data', 'healthy', 'attention', 'critical')),
  health_score smallint check (health_score between 0 and 100),
  priority text not null default 'normal' check (priority in ('normal', 'attention', 'critical')),
  diagnosis text,
  context text,
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.program_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 3 and 160),
  objective text not null,
  category text not null default 'consulting',
  duration_weeks smallint not null default 12 check (duration_weeks between 1 and 260),
  default_role text not null default 'main' check (default_role in ('main', 'track')),
  is_custom boolean not null default true,
  is_system boolean not null default false,
  version smallint not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  phases jsonb not null default '[]'::jsonb check (jsonb_typeof(phases) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug),
  unique (id, user_id),
  check (not is_system or not is_custom)
);

create table public.consulting_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unit_id uuid not null,
  template_id uuid references public.program_templates(id) on delete set null,
  parent_program_id uuid,
  role text not null default 'main' check (role in ('main', 'track')),
  name text not null check (char_length(trim(name)) between 3 and 160),
  objective text not null,
  status text not null default 'planning' check (status in ('planning', 'active', 'at_risk', 'paused', 'completed', 'cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  health_score smallint check (health_score between 0 and 100),
  start_date date,
  end_date date,
  current_phase text,
  scope_snapshot jsonb not null default '{"phases":[]}'::jsonb check (jsonb_typeof(scope_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint consulting_programs_unit_owner_fk
    foreign key (unit_id, user_id) references public.units(id, user_id) on delete cascade,
  constraint consulting_programs_parent_owner_fk
    foreign key (parent_program_id, user_id) references public.consulting_programs(id, user_id) on delete cascade,
  constraint consulting_programs_role_parent_check
    check ((role = 'main' and parent_program_id is null) or (role = 'track' and parent_program_id is not null)),
  constraint consulting_programs_date_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index consulting_programs_one_open_main_per_unit
  on public.consulting_programs (unit_id)
  where role = 'main' and status not in ('completed', 'cancelled');

create index units_user_id_idx on public.units (user_id);
create index units_user_lifecycle_idx on public.units (user_id, lifecycle_status);
create index program_templates_user_status_idx on public.program_templates (user_id, status);
create index consulting_programs_user_id_idx on public.consulting_programs (user_id);
create index consulting_programs_unit_id_idx on public.consulting_programs (unit_id);
create index consulting_programs_parent_id_idx on public.consulting_programs (parent_program_id) where parent_program_id is not null;
create index consulting_programs_template_id_idx on public.consulting_programs (template_id) where template_id is not null;

create trigger set_units_updated_at
before update on public.units
for each row execute function public.set_updated_at();

create trigger set_program_templates_updated_at
before update on public.program_templates
for each row execute function public.set_updated_at();

create trigger set_consulting_programs_updated_at
before update on public.consulting_programs
for each row execute function public.set_updated_at();

alter table public.units enable row level security;
alter table public.program_templates enable row level security;
alter table public.consulting_programs enable row level security;

create policy "units_select_own"
on public.units for select to authenticated
using ((select auth.uid()) = user_id);

create policy "units_insert_own"
on public.units for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "units_update_own"
on public.units for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "units_delete_own"
on public.units for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "program_templates_select_own"
on public.program_templates for select to authenticated
using ((select auth.uid()) = user_id);

create policy "program_templates_insert_own"
on public.program_templates for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "program_templates_update_custom_own"
on public.program_templates for update to authenticated
using ((select auth.uid()) = user_id and not is_system)
with check ((select auth.uid()) = user_id and not is_system);

create policy "program_templates_delete_custom_own"
on public.program_templates for delete to authenticated
using ((select auth.uid()) = user_id and not is_system);

create policy "consulting_programs_select_own"
on public.consulting_programs for select to authenticated
using ((select auth.uid()) = user_id);

create policy "consulting_programs_insert_own"
on public.consulting_programs for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "consulting_programs_update_own"
on public.consulting_programs for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "consulting_programs_delete_own"
on public.consulting_programs for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.units from anon;
revoke all on table public.program_templates from anon;
revoke all on table public.consulting_programs from anon;

grant select, insert, update, delete on table public.units to authenticated;
grant select, insert, update, delete on table public.program_templates to authenticated;
grant select, insert, update, delete on table public.consulting_programs to authenticated;

grant select, insert, update, delete on table public.units to service_role;
grant select, insert, update, delete on table public.program_templates to service_role;
grant select, insert, update, delete on table public.consulting_programs to service_role;
