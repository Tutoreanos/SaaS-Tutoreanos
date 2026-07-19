alter table public.activities
  add column unit_id uuid,
  add column program_id uuid,
  add column ends_at timestamptz,
  add column location text,
  add column attendee_emails text[] not null default '{}'::text[],
  add column send_invites boolean not null default false,
  add column sync_to_google boolean not null default false,
  add column google_event_id text,
  add column google_calendar_id text,
  add column google_event_link text,
  add column google_sync_status text not null default 'not_synced'
    check (google_sync_status in ('not_synced', 'pending', 'synced', 'error')),
  add column google_sync_error text,
  add column google_last_synced_at timestamptz,
  add constraint activities_time_range_check
    check (ends_at is null or ends_at > due_at),
  add constraint activities_unit_owner_fk
    foreign key (unit_id, user_id)
    references public.units(id, user_id)
    on delete set null (unit_id),
  add constraint activities_program_owner_fk
    foreign key (program_id, user_id)
    references public.consulting_programs(id, user_id)
    on delete set null (program_id);

create index activities_unit_owner_idx
  on public.activities (unit_id, user_id)
  where unit_id is not null;

create index activities_program_owner_idx
  on public.activities (program_id, user_id)
  where program_id is not null;

create unique index activities_google_event_owner_unique_idx
  on public.activities (user_id, google_calendar_id, google_event_id)
  where google_event_id is not null;

create table public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  calendar_id text not null default 'primary',
  calendar_summary text not null default 'Agenda principal',
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}'::text[],
  sync_enabled boolean not null default true,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.google_calendar_oauth_states (
  state_hash text primary key check (char_length(state_hash) = 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index google_calendar_oauth_states_expiry_idx
  on public.google_calendar_oauth_states (expires_at);

create trigger set_google_calendar_connections_updated_at
before update on public.google_calendar_connections
for each row execute function public.set_updated_at();

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;

revoke all on table public.google_calendar_connections from public, anon, authenticated;
revoke all on table public.google_calendar_oauth_states from public, anon, authenticated;

grant select, insert, update, delete on table public.google_calendar_connections to service_role;
grant select, insert, update, delete on table public.google_calendar_oauth_states to service_role;
