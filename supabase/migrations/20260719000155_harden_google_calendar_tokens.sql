create index google_calendar_oauth_states_user_id_idx
  on public.google_calendar_oauth_states (user_id);

create policy "google_calendar_connections_deny_clients"
on public.google_calendar_connections
for all
to anon, authenticated
using (false)
with check (false);

create policy "google_calendar_oauth_states_deny_clients"
on public.google_calendar_oauth_states
for all
to anon, authenticated
using (false)
with check (false);
