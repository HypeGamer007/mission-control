"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { OpenClawGatewayClient } from "@/lib/openclaw/gatewayClient";
import { useProjectGatewayCredentials } from "@/lib/openclaw/useProjectGatewayCredentials";
import { pasteOperatorTokenFromClipboard } from "@/lib/openclaw/connectionUi";

type Project = { id: string; name: string; openclaw_gateway_ws_url: string | null };

export default function OpsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const gwRef = useRef<OpenClawGatewayClient | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");

  const { gatewayUrl, setGatewayUrl, token, setToken, refresh: reloadProjectCredentials } = useProjectGatewayCredentials(
    supabase,
    projectId || undefined
  );

  const [status, setStatus] = useState("disconnected");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [health, setHealth] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [presence, setPresence] = useState<any>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<any>(null);
  const [logTail, setLogTail] = useState<any>(null);
  const [tickTs, setTickTs] = useState<number | null>(null);
  const [heartbeatEvents, setHeartbeatEvents] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await supabase.from("mc_projects").select("id,name,openclaw_gateway_ws_url").order("created_at", { ascending: false });
      if (!res.error && res.data?.length) {
        setProjects(res.data as Project[]);
        setProjectId(res.data[0]!.id);
      }
    })();
  }, [supabase]);

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
        gw.on("tick", (evt) => setTickTs((evt.payload as any)?.ts ?? Date.now()));
        gw.on("heartbeat", (evt) => {
          setHeartbeatEvents((prev) => {
            const next = [{ ts: Date.now(), payload: evt.payload }, ...prev];
            return next.slice(0, 25);
          });
        });
        setStatus("connecting…");
        await gw.connect();
        setStatus("connected");
      } catch (e: any) {
        setStatus("disconnected");
        setError(e?.message ?? "Failed to connect");
      } finally {
        setBusy(false);
      }
    },
    [gatewayUrl, token]
  );

  async function run(method: string, params?: unknown) {
    const gw = gwRef.current;
    if (!gw) return;
    setBusy(true);
    setError(null);
    try {
      const res = await gw.rpc<any>(method, params ?? {});
      return res;
    } catch (e: any) {
      setError(e?.message ?? `Failed: ${method}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Ops</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>Gateway health/presence/heartbeats for troubleshooting. Status: {status}</div>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>
      ) : null}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Project + connect</div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} placeholder="Gateway WS URL" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Operator token (per project)"
          autoComplete="off"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!projectId}
            onClick={() => void reloadProjectCredentials()}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700, fontSize: 13 }}
          >
            Reload from project
          </button>
          <button
            type="button"
            onClick={() => void pasteOperatorTokenFromClipboard(setToken)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700, fontSize: 13 }}
          >
            Paste token
          </button>
        </div>
        <button disabled={busy || !gatewayUrl} onClick={connect} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}>
          Connect
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          disabled={busy || status !== "connected"}
          onClick={async () => setHealth(await run("health"))}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}
        >
          health
        </button>
        <button
          disabled={busy || status !== "connected"}
          onClick={async () => setSummary(await run("status"))}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}
        >
          status
        </button>
        <button
          disabled={busy || status !== "connected"}
          onClick={async () => setPresence(await run("system-presence"))}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}
        >
          system-presence
        </button>
        <button
          disabled={busy || status !== "connected"}
          onClick={async () => setLastHeartbeat(await run("last-heartbeat"))}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}
        >
          last-heartbeat
        </button>
        <button
          disabled={busy || status !== "connected"}
          onClick={async () => setLogTail(await run("logs.tail", { limit: 200, maxBytes: 50_000 }))}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}
        >
          logs.tail
        </button>
        <button
          disabled={busy || status !== "connected"}
          onClick={async () => await run("set-heartbeats", { enabled: true })}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}
        >
          enable heartbeats
        </button>
        <button
          disabled={busy || status !== "connected"}
          onClick={async () => await run("set-heartbeats", { enabled: false })}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800 }}
        >
          disable heartbeats
        </button>
      </div>

      <Dump title="health" value={health} />
      <Dump title="status" value={summary} />
      <Dump title="system-presence" value={presence} />
      <Dump title="last-heartbeat" value={lastHeartbeat} />
      <Dump title="logs.tail" value={logTail} />
      <Dump title={`tick (last ts=${tickTs ?? "n/a"})`} value={tickTs ? { ts: tickTs } : null} />
      <Dump title="heartbeat (recent events)" value={heartbeatEvents.length ? heartbeatEvents : null} />
    </div>
  );
}

function Dump(props: { title: string; value: any }) {
  if (!props.value) return null;
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>{props.title}</div>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>{JSON.stringify(props.value, null, 2)}</pre>
    </div>
  );
}
