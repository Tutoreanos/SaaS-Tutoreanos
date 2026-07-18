drop index if exists public.consulting_programs_unit_id_idx;
drop index if exists public.consulting_programs_parent_id_idx;

create index consulting_programs_unit_owner_idx
  on public.consulting_programs (unit_id, user_id);

create index consulting_programs_parent_owner_idx
  on public.consulting_programs (parent_program_id, user_id)
  where parent_program_id is not null;
