-- Default agent teams when a project is created + idempotent seed for existing rows + RPC to re-seed missing defaults.

-- 1) After every new project, create three OpenClaw workspace buckets (general / outbound / ops).
create or replace function public.mc_projects_after_insert_seed_agent_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mc_agent_teams (project_id, name, openclaw_workspace, created_by)
  values
    (new.id, 'General', 'general', new.created_by),
    (new.id, 'Outbound', 'outbound', new.created_by),
    (new.id, 'Operations', 'ops', new.created_by);
  return new;
end;
$$;

drop trigger if exists mc_projects_seed_default_agent_teams on public.mc_projects;

create trigger mc_projects_seed_default_agent_teams
  after insert on public.mc_projects
  for each row
  execute function public.mc_projects_after_insert_seed_agent_teams();

-- 2) One-time / idempotent: for any project missing one of the default workspace keys, insert only the missing rows.
insert into public.mc_agent_teams (project_id, name, openclaw_workspace, created_by)
select
  p.id,
  d.name,
  d.ws,
  p.created_by
from public.mc_projects p
cross join (
  values
    ('General', 'general'),
    ('Outbound', 'outbound'),
    ('Operations', 'ops')
) as d(name, ws)
where not exists (
  select 1
  from public.mc_agent_teams t
  where t.project_id = p.id
    and t.openclaw_workspace = d.ws
);

-- 3) Callable from the app: add any still-missing default teams (e.g. user deleted all rows, or partial data).
create or replace function public.mc_seed_default_agent_teams(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_mc_project_member(p_project_id) then
    raise exception 'not allowed';
  end if;

  insert into public.mc_agent_teams (project_id, name, openclaw_workspace, created_by)
  select
    p_project_id,
    d.name,
    d.ws,
    auth.uid()
  from (
    values
      ('General', 'general'),
      ('Outbound', 'outbound'),
      ('Operations', 'ops')
  ) as d(name, ws)
  where not exists (
    select 1
    from public.mc_agent_teams t
    where t.project_id = p_project_id
      and t.openclaw_workspace = d.ws
  );
end;
$$;

grant execute on function public.mc_seed_default_agent_teams(uuid) to authenticated;
