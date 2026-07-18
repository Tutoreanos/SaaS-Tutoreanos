create or replace function public.validate_consulting_program_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_unit_id uuid;
  parent_role text;
begin
  if new.role = 'track' then
    select program.unit_id, program.role
      into parent_unit_id, parent_role
    from public.consulting_programs as program
    where program.id = new.parent_program_id
      and program.user_id = new.user_id;

    if parent_unit_id is null or parent_role <> 'main' or parent_unit_id <> new.unit_id then
      raise exception using
        errcode = '23514',
        message = 'A complementary track must belong to a main program from the same unit.';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_consulting_program_parent_before_write
before insert or update of unit_id, user_id, parent_program_id, role
on public.consulting_programs
for each row execute function public.validate_consulting_program_parent();

revoke all on function public.validate_consulting_program_parent() from public, anon, authenticated;
