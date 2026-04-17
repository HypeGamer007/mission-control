"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { OpenClawGatewayClient } from "@/lib/openclaw/gatewayClient";
import { useProjectGatewayCredentials } from "@/lib/openclaw/useProjectGatewayCredentials";
import { pasteOperatorTokenFromClipboard } from "@/lib/openclaw/connectionUi";

type Project = { id: string; name: string; openclaw_gateway_ws_url: string | null };
type AgentTeam = { id: string; project_id: string; name: string; openclaw_workspace: string };
type AgentSummary = { id: string; name?: string; workspace?: string; emoji?: string; avatarUrl?: string };

type FilterMode = { kind: "all" } | { kind: "team"; workspace: string } | { kind: "unmatched" };

function normalizeWorkspace(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function AgentsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const gwRef = useRef<OpenClawGatewayClient | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [agentTeams, setAgentTeams] = useState<AgentTeam[]>([]);

  const { gatewayUrl, setGatewayUrl, token, setToken, refresh: reloadProjectCredentials } = useProjectGatewayCredentials(
    supabase,
    projectId || undefined
  );
  const [status, setStatus] = useState("disconnected");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [filter, setFilter] = useState<FilterMode>({ kind: "all" });

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamWorkspace, setNewTeamWorkspace] = useState("");

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamWorkspace, setEditTeamWorkspace] = useState("");
  const [editPrevWorkspace, setEditPrevWorkspace] = useState("");

  const [createTeamId, setCreateTeamId] = useState("");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🧠");

  const teamWorkspaces = useMemo(() => new Set(agentTeams.map((t) => t.openclaw_workspace)), [agentTeams]);

  const filteredAgents = useMemo(() => {
    if (filter.kind === "all") return agents;
    if (filter.kind === "team") return agents.filter((a) => a.workspace === filter.workspace);
    return agents.filter((a) => {
      const w = a.workspace ?? "";
      return w && !teamWorkspaces.has(w);
    });
  }, [agents, filter, teamWorkspaces]);

  const refreshProjects = useCallback(async () => {
    const res = await supabase.from("mc_projects").select("id,name,openclaw_gateway_ws_url").order("created_at", { ascending: false });
    if (res.error) throw res.error;
    const rows = (res.data ?? []) as Project[];
    setProjects(rows);
    setProjectId((prev) => (prev ? prev : rows[0]?.id ?? ""));
  }, [supabase]);

  const refreshAgentTeams = useCallback(async () => {
    if (!projectId) {
      setAgentTeams([]);
      return;
    }
    const res = await supabase.from("mc_agent_teams").select("id,project_id,name,openclaw_workspace").eq("project_id", projectId).order("name");
    if (res.error) throw res.error;
    setAgentTeams((res.data ?? []) as AgentTeam[]);
  }, [supabase, projectId]);

  const refreshAgents = useCallback(async () => {
    const gw = gwRef.current;
    if (!gw) return;
    setBusy(true);
    setError(null);
    try {
      const res = await gw.rpc<{ agents?: AgentSummary[] }>("agents.list", {});
      setAgents((res?.agents ?? []) as AgentSummary[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshProjects();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load projects");
      }
    })();
  }, [refreshProjects]);

  useEffect(() => {
    void (async () => {
      try {
        await refreshAgentTeams();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load agent teams");
      }
    })();
  }, [refreshAgentTeams]);

  useEffect(() => {
    if (!agentTeams.length) {
      setCreateTeamId("");
      return;
    }
    if (!createTeamId || !agentTeams.some((t) => t.id === createTeamId)) {
      setCreateTeamId(agentTeams[0]!.id);
    }
  }, [agentTeams, createTeamId]);

  const connect = useMemo(
    () => async () => {
      setBusy(true);
      setError(null);
      try {
        gwRef.current?.disconnect();
        const gw = new OpenClawGatewayClient({
          url: gatewayUrl,
          token,
          role: "operator",
          scopes: ["operator.read", "operator.write"],
          client: { id: "mission-control", version: "0.1.0", platform: "web", mode: "operator", displayName: "Mission Control" }
        });
        gwRef.current = gw;
        setStatus("connecting…");
        await gw.connect();
        setStatus("connected");
        await refreshAgents();
      } catch (e: unknown) {
        setStatus("disconnected");
        setError(e instanceof Error ? e.message : "Failed to connect");
      } finally {
        setBusy(false);
      }
    },
    [gatewayUrl, token, refreshAgents]
  );

  async function createAgentTeam() {
    if (!projectId) return;
    const ws = normalizeWorkspace(newTeamWorkspace);
    if (!newTeamName.trim() || !ws) {
      setError("Agent team needs a name and an OpenClaw workspace key.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated");

      const ins = await supabase
        .from("mc_agent_teams")
        .insert({
          project_id: projectId,
          name: newTeamName.trim(),
          openclaw_workspace: ws,
          created_by: user.id
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;

      setNewTeamName("");
      setNewTeamWorkspace("");
      await refreshAgentTeams();
      setCreateTeamId(ins.data!.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create agent team");
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaultTeams() {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("mc_seed_default_agent_teams", { p_project_id: projectId });
      if (rpcError) throw rpcError;
      await refreshAgentTeams();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to seed default teams");
    } finally {
      setBusy(false);
    }
  }

  function startEditTeam(t: AgentTeam) {
    setEditingTeamId(t.id);
    setEditTeamName(t.name);
    setEditTeamWorkspace(t.openclaw_workspace);
    setEditPrevWorkspace(t.openclaw_workspace);
  }

  function cancelEditTeam() {
    setEditingTeamId(null);
  }

  async function saveTeamEdit() {
    if (!editingTeamId || !projectId) return;
    const norm = normalizeWorkspace(editTeamWorkspace);
    if (!editTeamName.trim() || !norm) {
      setError("Team name and workspace key are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const upd = await supabase
        .from("mc_agent_teams")
        .update({ name: editTeamName.trim(), openclaw_workspace: norm })
        .eq("id", editingTeamId)
        .eq("project_id", projectId);
      if (upd.error) throw upd.error;

      if (filter.kind === "team" && filter.workspace === editPrevWorkspace) {
        setFilter({ kind: "team", workspace: norm });
      }
      setEditingTeamId(null);
      await refreshAgentTeams();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update agent team");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAgentTeam(team: AgentTeam) {
    if (
      !confirm(
        `Remove agent team “${team.name}”? Gateway agents already created under workspace “${team.openclaw_workspace}” are not renamed or deleted on the Gateway—only this app’s grouping changes.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const del = await supabase.from("mc_agent_teams").delete().eq("id", team.id);
      if (del.error) throw del.error;
      if (editingTeamId === team.id) setEditingTeamId(null);
      if (filter.kind === "team" && filter.workspace === team.openclaw_workspace) setFilter({ kind: "all" });
      await refreshAgentTeams();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove agent team");
    } finally {
      setBusy(false);
    }
  }

  async function createAgent() {
    const gw = gwRef.current;
    const team = agentTeams.find((t) => t.id === createTeamId);
    if (!gw || !team) return;
    setBusy(true);
    setError(null);
    try {
      await gw.rpc("agents.create", { name, workspace: team.openclaw_workspace, emoji });
      setName("");
      await refreshAgents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAgent(agentId: string) {
    const gw = gwRef.current;
    if (!gw) return;
    setBusy(true);
    setError(null);
    try {
      await gw.rpc("agents.delete", { agentId });
      await refreshAgents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete agent");
    } finally {
      setBusy(false);
    }
  }

  const selectedTeam = agentTeams.find((t) => t.id === createTeamId);

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Agents</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          New projects get default teams (<code>general</code>, <code>outbound</code>, <code>ops</code>). Each team maps to an OpenClaw <code>workspace</code>. Connect to your project Gateway, then create agents under a team. Status: {status}
        </div>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>
      ) : null}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Project</div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", maxWidth: 480 }}>
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Agent teams and gateway URL are per project. Set the Gateway URL on the Projects page if needed.
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Connect to Gateway</div>
        <input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} placeholder="Gateway WS URL" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Operator token (per project; set on Projects page)"
          autoComplete="off"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy || !projectId}
            onClick={() => void reloadProjectCredentials()}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700, fontSize: 13 }}
          >
            Reload from project
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pasteOperatorTokenFromClipboard(setToken)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700, fontSize: 13 }}
          >
            Paste token
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button disabled={busy || !gatewayUrl} onClick={connect} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}>
            Connect
          </button>
          <button disabled={busy || status !== "connected"} onClick={refreshAgents} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}>
            Refresh agents
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800 }}>Agent teams (OpenClaw workspaces)</div>
          <button
            type="button"
            disabled={busy || !projectId}
            onClick={seedDefaultTeams}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700, fontSize: 13 }}
          >
            Seed default teams
          </button>
        </div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Adds <code>general</code>, <code>outbound</code>, and <code>ops</code> if they are missing. Renaming a workspace here does not move existing Gateway agents—you would recreate them or change them in OpenClaw separately.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Team name</span>
            <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Outbound SDR" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Workspace key</span>
            <input
              value={newTeamWorkspace}
              onChange={(e) => setNewTeamWorkspace(e.target.value)}
              placeholder="e.g. outbound-sdr"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>
          <button
            disabled={busy || !projectId || !newTeamName.trim() || !newTeamWorkspace.trim()}
            onClick={createAgentTeam}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}
          >
            Add team
          </button>
        </div>

        {agentTeams.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {agentTeams.map((t) => (
              <div key={t.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                {editingTeamId === t.id ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Team name</span>
                        <input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Workspace key</span>
                        <input value={editTeamWorkspace} onChange={(e) => setEditTeamWorkspace(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" disabled={busy} onClick={saveTeamEdit} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 700 }}>
                        Save
                      </button>
                      <button type="button" disabled={busy} onClick={cancelEditTeam} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontWeight: 700 }}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span>
                      <strong>{t.name}</strong> <span style={{ opacity: 0.75 }}>({t.openclaw_workspace})</span>
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" disabled={busy} onClick={() => startEditTeam(t)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12 }}>
                        Edit
                      </button>
                      <button type="button" disabled={busy} onClick={() => deleteAgentTeam(t)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12 }}>
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.7, fontSize: 14 }}>
            No agent teams for this project. Click <strong>Seed default teams</strong> or add a custom team above.
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Create agent</div>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Agent team</span>
          <select
            value={createTeamId}
            onChange={(e) => setCreateTeamId(e.target.value)}
            disabled={!agentTeams.length}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          >
            {agentTeams.length === 0 ? <option value="">Create or seed agent teams first</option> : null}
            {agentTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.openclaw_workspace}
              </option>
            ))}
          </select>
        </label>
        {selectedTeam ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            New agents join OpenClaw workspace <code>{selectedTeam.openclaw_workspace}</code>.
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Emoji" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        </div>
        <button
          disabled={busy || status !== "connected" || !name.trim() || !createTeamId}
          onClick={createAgent}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}
        >
          Create agent
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Agents</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <span style={{ opacity: 0.75 }}>Show</span>
            <select
              value={
                filter.kind === "all"
                  ? "all"
                  : filter.kind === "unmatched"
                    ? "unmatched"
                    : `team:${filter.workspace}`
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") setFilter({ kind: "all" });
                else if (v === "unmatched") setFilter({ kind: "unmatched" });
                else if (v.startsWith("team:")) setFilter({ kind: "team", workspace: v.slice("team:".length) });
              }}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              <option value="all">All workspaces</option>
              {agentTeams.map((t) => (
                <option key={t.id} value={`team:${t.openclaw_workspace}`}>
                  {t.name} ({t.openclaw_workspace})
                </option>
              ))}
              <option value="unmatched">Unmatched (not in a project team)</option>
            </select>
          </label>
          <span style={{ fontSize: 13, opacity: 0.65 }}>
            Showing {filteredAgents.length} of {agents.length}
          </span>
        </div>

        {filteredAgents.map((a) => (
          <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 900 }}>
                {(a.emoji ? a.emoji + " " : "") + (a.name ?? a.id)}
              </div>
              <button disabled={busy || status !== "connected"} onClick={() => deleteAgent(a.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}>
                Delete
              </button>
            </div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>Agent ID: {a.id}</div>
            {a.workspace ? <div style={{ opacity: 0.75, fontSize: 12 }}>Workspace: {a.workspace}</div> : null}
          </div>
        ))}
        {!agents.length ? <div style={{ opacity: 0.7 }}>No agents loaded. Connect and refresh.</div> : null}
        {agents.length > 0 && !filteredAgents.length ? <div style={{ opacity: 0.7 }}>No agents in this filter.</div> : null}
      </div>
    </div>
  );
}
