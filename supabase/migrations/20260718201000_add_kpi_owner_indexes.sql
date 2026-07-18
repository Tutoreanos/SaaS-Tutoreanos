create index if not exists project_kpis_user_id_idx
  on public.project_kpis (user_id);

create index if not exists kpi_measurements_user_id_idx
  on public.kpi_measurements (user_id);
