-- OpenClaw Mission Control: initial schema + RLS
-- Tables use mc_* prefix to avoid collisions (e.g. public.team_members used by marketing site).

create extension if not exists pgcrypto;

-- Users
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user can read self"
on public.profiles for select
using (user_id = auth.uid());

create policy "profiles: user can upsert self"
on public.profiles for insert
with check (user_id = auth.uid());

create policy "profiles: user can update self"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Teams
create table if not exists public.mc_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.mc_team_members (
  team_id uuid not null references public.mc_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- member|admin
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create or replace function public.is_mc_team_member(team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mc_team_members tm
    where tm.team_id = is_mc_team_member.team_id
      and tm.user_id = auth.uid()
  );
$$;

alter table public.mc_teams enable row level security;
alter table public.mc_team_members enable row level security;

create policy "mc_teams: members can read"
on public.mc_teams for select
using (public.is_mc_team_member(id));

create policy "mc_teams: authenticated can create"
on public.mc_teams for insert
with check (auth.uid() = created_by);

create policy "mc_team_members: members can read"
on public.mc_team_members for select
using (public.is_mc_team_member(team_id));

create policy "mc_team_members: team creator can add"
on public.mc_team_members for insert
with check (
  exists (select 1 from public.mc_teams t where t.id = team_id and t.created_by = auth.uid())
);

-- Projects
create table if not exists public.mc_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.mc_teams(id) on delete cascade,
  name text not null,
  description text,
  openclaw_gateway_ws_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.mc_project_members (
  project_id uuid not null references public.mc_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- member|admin
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create or replace function public.is_mc_project_member(project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mc_project_members pm
    where pm.project_id = is_mc_project_member.project_id
      and pm.user_id = auth.uid()
  );
$$;

alter table public.mc_projects enable row level security;
alter table public.mc_project_members enable row level security;

create policy "mc_projects: members can read"
on public.mc_projects for select
using (public.is_mc_project_member(id));

create policy "mc_projects: team members can create"
on public.mc_projects for insert
with check (public.is_mc_team_member(team_id) and auth.uid() = created_by);

create policy "mc_project_members: members can read"
on public.mc_project_members for select
using (public.is_mc_project_member(project_id));

create policy "mc_project_members: project creator can add"
on public.mc_project_members for insert
with check (
  exists (select 1 from public.mc_projects p where p.id = project_id and p.created_by = auth.uid())
);

-- Leads
create table if not exists public.mc_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mc_projects(id) on delete cascade,
  status text not null default 'new', -- new|qualified|contacted|replied|disqualified
  full_name text,
  title text,
  company text,
  email text,
  website text,
  linkedin_url text,
  location text,
  tags text[] not null default '{}',
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_lead_sources (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.mc_leads(id) on delete cascade,
  kind text not null, -- url|post|community|manual
  url text,
  raw jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table if not exists public.mc_lead_enrichments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.mc_leads(id) on delete cascade,
  provider text not null default 'openclaw',
  summary text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mc_leads enable row level security;
alter table public.mc_lead_sources enable row level security;
alter table public.mc_lead_enrichments enable row level security;

create policy "mc_leads: project members can read"
on public.mc_leads for select
using (public.is_mc_project_member(project_id));

create policy "mc_leads: project members can create"
on public.mc_leads for insert
with check (public.is_mc_project_member(project_id) and auth.uid() = created_by);

create policy "mc_leads: project members can update"
on public.mc_leads for update
using (public.is_mc_project_member(project_id))
with check (public.is_mc_project_member(project_id));

create policy "mc_lead_sources: project members can read"
on public.mc_lead_sources for select
using (exists (select 1 from public.mc_leads l where l.id = lead_id and public.is_mc_project_member(l.project_id)));

create policy "mc_lead_sources: project members can create"
on public.mc_lead_sources for insert
with check (exists (select 1 from public.mc_leads l where l.id = lead_id and public.is_mc_project_member(l.project_id)));

create policy "mc_lead_enrichments: project members can read"
on public.mc_lead_enrichments for select
using (exists (select 1 from public.mc_leads l where l.id = lead_id and public.is_mc_project_member(l.project_id)));

create policy "mc_lead_enrichments: project members can create"
on public.mc_lead_enrichments for insert
with check (exists (select 1 from public.mc_leads l where l.id = lead_id and public.is_mc_project_member(l.project_id)));

-- Outreach
create table if not exists public.mc_outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mc_projects(id) on delete cascade,
  name text not null,
  channel text not null default 'email', -- email|linkedin|other
  steps jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.mc_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.mc_outreach_sequences(id) on delete cascade,
  lead_id uuid not null references public.mc_leads(id) on delete cascade,
  status text not null default 'draft', -- draft|approved|sent|failed
  subject text,
  body text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mc_outreach_sequences enable row level security;
alter table public.mc_outreach_messages enable row level security;

create policy "mc_outreach_sequences: project members can read"
on public.mc_outreach_sequences for select
using (public.is_mc_project_member(project_id));

create policy "mc_outreach_sequences: project members can create"
on public.mc_outreach_sequences for insert
with check (public.is_mc_project_member(project_id) and auth.uid() = created_by);

create policy "mc_outreach_messages: project members can read"
on public.mc_outreach_messages for select
using (
  exists (
    select 1
    from public.mc_outreach_sequences s
    join public.mc_leads l on l.id = mc_outreach_messages.lead_id
    where s.id = sequence_id
      and l.project_id = s.project_id
      and public.is_mc_project_member(s.project_id)
  )
);

create policy "mc_outreach_messages: project members can create"
on public.mc_outreach_messages for insert
with check (
  exists (
    select 1
    from public.mc_outreach_sequences s
    join public.mc_leads l on l.id = mc_outreach_messages.lead_id
    where s.id = sequence_id
      and l.project_id = s.project_id
      and public.is_mc_project_member(s.project_id)
  )
);

-- Runs + audit
create table if not exists public.mc_agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mc_projects(id) on delete cascade,
  openclaw_session_key text,
  kind text not null, -- cos_chat|lead_source|enrich|draft_outreach|other
  status text not null default 'running', -- running|succeeded|failed|aborted
  meta jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.mc_audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.mc_projects(id) on delete cascade,
  team_id uuid references public.mc_teams(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mc_agent_runs enable row level security;
alter table public.mc_audit_events enable row level security;

create policy "mc_agent_runs: project members can read"
on public.mc_agent_runs for select
using (public.is_mc_project_member(project_id));

create policy "mc_agent_runs: project members can create"
on public.mc_agent_runs for insert
with check (public.is_mc_project_member(project_id));

create policy "mc_audit_events: project members can read"
on public.mc_audit_events for select
using (
  (project_id is not null and public.is_mc_project_member(project_id))
  or (team_id is not null and public.is_mc_team_member(team_id))
);

create policy "mc_audit_events: authenticated can create"
on public.mc_audit_events for insert
with check (auth.uid() is not null);

-- updated_at trigger for leads
create or replace function public.mc_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mc_leads_updated_at on public.mc_leads;
create trigger trg_mc_leads_updated_at
before update on public.mc_leads
for each row execute function public.mc_set_updated_at();
