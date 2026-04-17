-- Bootstrap helpers:
-- - Ensure created_by is always set to auth.uid() for team/project creation.
-- - Relax insert policies to depend on auth.uid() instead of trusting client-provided created_by.

create or replace function public.mc_set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If no authenticated user, keep original value (RLS should still block inserts).
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mc_teams_set_created_by on public.mc_teams;
create trigger trg_mc_teams_set_created_by
  before insert on public.mc_teams
  for each row
  execute function public.mc_set_created_by();

drop trigger if exists trg_mc_projects_set_created_by on public.mc_projects;
create trigger trg_mc_projects_set_created_by
  before insert on public.mc_projects
  for each row
  execute function public.mc_set_created_by();

-- Replace insert policies to avoid requiring client to send created_by.
drop policy if exists "mc_teams: authenticated can create" on public.mc_teams;
create policy "mc_teams: authenticated can create"
on public.mc_teams for insert
with check (auth.uid() is not null);

drop policy if exists "mc_projects: team members can create" on public.mc_projects;
create policy "mc_projects: team members can create"
on public.mc_projects for insert
with check (public.is_mc_team_member(team_id) and auth.uid() is not null);

