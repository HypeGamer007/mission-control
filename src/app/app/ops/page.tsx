"use client";

import { useMemo, useRef, useState } from "react";
import { env } from "@/lib/env";
import { OpenClawGatewayClient } from "@/lib/openclaw/gatewayClient";

export default function OpsPage() {
  const gwRef = useRef<OpenClawGatewayClient | null>(null);

  const [gatewayUrl, setGatewayUrl] = useState(env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL);
  const [token, setToken] = useState(env.NEXT_PUBLIC_OPENCLAW_OPERATOR_TOKEN ?? "");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div style={{ fontWeight: 800 }}>Connect</div>
        <input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} placeholder="Gateway WS URL" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Operator token" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
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

