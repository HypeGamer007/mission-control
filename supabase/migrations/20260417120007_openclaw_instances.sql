-- OpenClaw instances: named Gateway connections assignable to projects.
-- Local-dev friendly (RLS currently disabled by migration 20260417120006).

create table if not exists public.mc_openclaw_instances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gateway_ws_url text not null,
  operator_token text,
  created_at timestamptz not null default now()
);

create index if not exists mc_openclaw_instances_created_at_idx
  on public.mc_openclaw_instances (created_at desc);

alter table public.mc_projects
  add column if not exists openclaw_instance_id uuid references public.mc_openclaw_instances(id) on delete set null;

create index if not exists mc_projects_openclaw_instance_id_idx
  on public.mc_projects (openclaw_instance_id);

