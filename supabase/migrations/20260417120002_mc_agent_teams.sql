-- Agent teams: group OpenClaw agents by workspace string, scoped to a Mission Control project.

create table if not exists public.mc_agent_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mc_projects(id) on delete cascade,
  name text not null,
  openclaw_workspace text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint mc_agent_teams_workspace_unique unique (project_id, openclaw_workspace)
);

create index if not exists mc_agent_teams_project_id_idx on public.mc_agent_teams (project_id);

alter table public.mc_agent_teams enable row level security;

create policy "mc_agent_teams: project members can read"
on public.mc_agent_teams for select
using (public.is_mc_project_member(project_id));

create policy "mc_agent_teams: project members can insert"
on public.mc_agent_teams for insert
with check (public.is_mc_project_member(project_id) and auth.uid() = created_by);

create policy "mc_agent_teams: project members can update"
on public.mc_agent_teams for update
using (public.is_mc_project_member(project_id))
with check (public.is_mc_project_member(project_id));

create policy "mc_agent_teams: project members can delete"
on public.mc_agent_teams for delete
using (public.is_mc_project_member(project_id));
