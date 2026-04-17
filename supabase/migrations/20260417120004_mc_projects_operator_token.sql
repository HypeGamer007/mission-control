-- Per-project OpenClaw operator token (falls back to env in the app when null).
-- Readable only by project members via existing SELECT policy; updatable by members below.

alter table public.mc_projects
  add column if not exists openclaw_operator_token text;

comment on column public.mc_projects.openclaw_operator_token is
  'Gateway operator bearer token for this project. Prefer storing only for trusted project members; for stricter isolation use a server proxy or Supabase Vault.';

create policy "mc_projects: members can update"
on public.mc_projects for update
using (public.is_mc_project_member(id))
with check (public.is_mc_project_member(id));
