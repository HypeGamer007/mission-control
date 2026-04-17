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
  const [newProjectOperatorToken, setNewProjectOperatorToken] = useState("");

  const [gwEditProjectId, setGwEditProjectId] = useState<string | null>(null);
  const [gwEditUrl, setGwEditUrl] = useState("");
  const [gwEditToken, setGwEditToken] = useState("");
  const [gwEditLoading, setGwEditLoading] = useState(false);

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
          openclaw_operator_token: newProjectOperatorToken.trim() || null,
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
      setNewProjectOperatorToken("");
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
          Teams and projects are stored in Supabase and scoped by RLS. Set Gateway URL and operator token per project (falls back to app env when left empty).
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
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>
            New projects automatically get three default <strong>agent teams</strong> (OpenClaw workspaces: <code>general</code>, <code>outbound</code>, <code>ops</code>). You can add more on the Agents page.
          </div>
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
            <input
              value={newProjectOperatorToken}
              onChange={(e) => setNewProjectOperatorToken(e.target.value)}
              placeholder="OpenClaw operator token (optional, stored for this project)"
              autoComplete="off"
              type="password"
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
              ) : (
                <div style={{ opacity: 0.65, marginTop: 6, fontSize: 12 }}>Gateway: (using app default from env)</div>
              )}
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Project ID: {p.id}</div>
              {gwEditProjectId === p.id ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>OpenClaw connection</div>
                  {gwEditLoading ? (
                    <div style={{ fontSize: 13, opacity: 0.7 }}>Loading…</div>
                  ) : (
                    <>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Gateway WS URL</span>
                        <input
                          value={gwEditUrl}
                          onChange={(e) => setGwEditUrl(e.target.value)}
                          placeholder="wss://…"
                          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Operator token</span>
                        <input
                          value={gwEditToken}
                          onChange={(e) => setGwEditToken(e.target.value)}
                          placeholder="Leave empty to clear; app env used as fallback when unset"
                          autoComplete="off"
                          type="password"
                          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
                        />
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError(null);
                            try {
                              const u = await supabase
                                .from("mc_projects")
                                .update({
                                  openclaw_gateway_ws_url: gwEditUrl.trim() || null,
                                  openclaw_operator_token: gwEditToken.trim() || null
                                })
                                .eq("id", p.id);
                              if (u.error) throw u.error;
                              setGwEditProjectId(null);
                              await refresh();
                            } catch (e: any) {
                              setError(e?.message ?? "Failed to save");
                            } finally {
                              setBusy(false);
                            }
                          }}
                          style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 700 }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setGwEditProjectId(null)}
                          style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setGwEditProjectId(p.id);
                    setGwEditLoading(true);
                    setGwEditUrl("");
                    setGwEditToken("");
                    setError(null);
                    try {
                      const res = await supabase
                        .from("mc_projects")
                        .select("openclaw_gateway_ws_url, openclaw_operator_token")
                        .eq("id", p.id)
                        .single();
                      if (res.error) throw res.error;
                      setGwEditUrl((res.data?.openclaw_gateway_ws_url as string) ?? "");
                      setGwEditToken((res.data?.openclaw_operator_token as string) ?? "");
                    } catch (e: any) {
                      setError(e?.message ?? "Failed to load credentials");
                      setGwEditProjectId(null);
                    } finally {
                      setGwEditLoading(false);
                    }
                  }}
                  style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700, fontSize: 13 }}
                >
                  Edit OpenClaw URL and token
                </button>
              )}
            </div>
          ))}
          {!projects.length ? <div style={{ opacity: 0.7 }}>No projects yet.</div> : null}
        </div>
      </div>
    </div>
  );
}

