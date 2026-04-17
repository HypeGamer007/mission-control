"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Team = { id: string; name: string };
type Project = { id: string; name: string; description: string | null; team_id: string; openclaw_gateway_ws_url: string | null };

export default function ProjectsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [newProjectTeamId, setNewProjectTeamId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectGatewayUrl, setNewProjectGatewayUrl] = useState("");

  async function refresh() {
    setError(null);
    const [teamsRes, projectsRes] = await Promise.all([
      supabase.from("mc_teams").select("id,name").order("created_at", { ascending: false }),
      supabase.from("mc_projects").select("id,name,description,team_id,openclaw_gateway_ws_url").order("created_at", { ascending: false })
    ]);
    if (teamsRes.error) setError(teamsRes.error.message);
    if (projectsRes.error) setError(projectsRes.error.message);
    setTeams(teamsRes.data ?? []);
    setProjects(projectsRes.data ?? []);
    if (!newProjectTeamId && (teamsRes.data?.[0]?.id ?? "")) setNewProjectTeamId(teamsRes.data![0]!.id);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTeam() {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated");

      const teamIns = await supabase.from("mc_teams").insert({ name: newTeamName, created_by: user.id }).select("id,name").single();
      if (teamIns.error) throw teamIns.error;

      const memberIns = await supabase.from("mc_team_members").insert({ team_id: teamIns.data.id, user_id: user.id, role: "admin" });
      if (memberIns.error) throw memberIns.error;

      setNewTeamName("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create team");
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated");

      const projectIns = await supabase
        .from("mc_projects")
        .insert({
          team_id: newProjectTeamId,
          name: newProjectName,
          description: newProjectDesc || null,
          openclaw_gateway_ws_url: newProjectGatewayUrl || null,
          created_by: user.id
        })
        .select("id")
        .single();
      if (projectIns.error) throw projectIns.error;

      const memberIns = await supabase.from("mc_project_members").insert({ project_id: projectIns.data.id, user_id: user.id, role: "admin" });
      if (memberIns.error) throw memberIns.error;

      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectGatewayUrl("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Projects</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Teams and projects are stored in Supabase and scoped by RLS. Add your OpenClaw Gateway WS URL per project.
        </div>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Create team</div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            <button
              disabled={busy || !newTeamName}
              onClick={createTeam}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 700 }}
            >
              Create team
            </button>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Create project</div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <select
              value={newProjectTeamId}
              onChange={(e) => setNewProjectTeamId(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              <option value="" disabled>
                Select team
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            <input
              value={newProjectGatewayUrl}
              onChange={(e) => setNewProjectGatewayUrl(e.target.value)}
              placeholder="OpenClaw Gateway WS URL (optional)"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            <textarea
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            <button
              disabled={busy || !newProjectTeamId || !newProjectName}
              onClick={createProject}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 700 }}
            >
              Create project
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Your projects</div>
        <div style={{ display: "grid", gap: 10 }}>
          {projects.map((p) => (
            <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              {p.description ? <div style={{ opacity: 0.75, marginTop: 6 }}>{p.description}</div> : null}
              {p.openclaw_gateway_ws_url ? (
                <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Gateway: {p.openclaw_gateway_ws_url}</div>
              ) : null}
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Project ID: {p.id}</div>
            </div>
          ))}
          {!projects.length ? <div style={{ opacity: 0.7 }}>No projects yet.</div> : null}
        </div>
      </div>
    </div>
  );
}

