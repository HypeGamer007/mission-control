"use client";

import { useMemo, useRef, useState } from "react";
import { env } from "@/lib/env";
import { OpenClawGatewayClient } from "@/lib/openclaw/gatewayClient";

type AgentSummary = { id: string; name?: string; workspace?: string; emoji?: string; avatarUrl?: string };

export default function AgentsPage() {
  const gwRef = useRef<OpenClawGatewayClient | null>(null);

  const [gatewayUrl, setGatewayUrl] = useState(env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL);
  const [token, setToken] = useState(env.NEXT_PUBLIC_OPENCLAW_OPERATOR_TOKEN ?? "");
  const [status, setStatus] = useState("disconnected");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentSummary[]>([]);

  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("marketing-suite");
  const [emoji, setEmoji] = useState("🧠");

  const connect = useMemo(
    () => async () => {
      setBusy(true);
      setError(null);
      try {
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
        await refresh();
      } catch (e: any) {
        setStatus("disconnected");
        setError(e?.message ?? "Failed to connect");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gatewayUrl, token]
  );

  async function refresh() {
    const gw = gwRef.current;
    if (!gw) return;
    setBusy(true);
    setError(null);
    try {
      const res = await gw.rpc<any>("agents.list", {});
      setAgents((res?.agents ?? []) as AgentSummary[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load agents");
    } finally {
      setBusy(false);
    }
  }

  async function createAgent() {
    const gw = gwRef.current;
    if (!gw) return;
    setBusy(true);
    setError(null);
    try {
      await gw.rpc("agents.create", { name, workspace, emoji });
      setName("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create agent");
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
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Agents</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>Manage OpenClaw agents via Gateway RPC (`agents.*`). Status: {status}</div>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>
      ) : null}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Connect</div>
        <input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} placeholder="Gateway WS URL" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Operator token" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button disabled={busy || !gatewayUrl} onClick={connect} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}>
            Connect
          </button>
          <button disabled={busy || status !== "connected"} onClick={refresh} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Create agent</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="Workspace" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Emoji" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        </div>
        <button disabled={busy || status !== "connected" || !name || !workspace} onClick={createAgent} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}>
          Create
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Agents</div>
        {agents.map((a) => (
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
        {!agents.length ? <div style={{ opacity: 0.7 }}>No agents loaded.</div> : null}
      </div>
    </div>
  );
}

