-- LOCAL DEV ONLY: disable RLS on Mission Control tables.
-- This removes membership gating so you can freely create teams/projects/leads locally.
-- Do NOT use in production.

do $$
begin
  -- Core org tables
  execute 'alter table if exists public.profiles disable row level security';
  execute 'alter table if exists public.mc_teams disable row level security';
  execute 'alter table if exists public.mc_team_members disable row level security';
  execute 'alter table if exists public.mc_projects disable row level security';
  execute 'alter table if exists public.mc_project_members disable row level security';
  execute 'alter table if exists public.mc_agent_teams disable row level security';

  -- CRM/workflow tables
  execute 'alter table if exists public.mc_leads disable row level security';
  execute 'alter table if exists public.mc_lead_sources disable row level security';
  execute 'alter table if exists public.mc_lead_enrichments disable row level security';
  execute 'alter table if exists public.mc_outreach_sequences disable row level security';
  execute 'alter table if exists public.mc_outreach_messages disable row level security';
  execute 'alter table if exists public.mc_agent_runs disable row level security';
  execute 'alter table if exists public.mc_audit_events disable row level security';
end $$;

