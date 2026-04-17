"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { OpenClawGatewayClient } from "@/lib/openclaw/gatewayClient";
import { useOpenClawConnection } from "@/lib/openclaw/OpenClawConnectionContext";
import { pasteOperatorTokenFromClipboard } from "@/lib/openclaw/connectionUi";

type InstanceRow = { id: string; name: string; gateway_ws_url: string; operator_token: string | null; created_at: string };

export default function ConnectionPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const conn = useOpenClawConnection();
  const gwRef = useRef<OpenClawGatewayClient | null>(null);

  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [instanceName, setInstanceName] = useState("Local Gateway");

  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [diag, setDiag] = useState<string[]>([]);

  function pushDiag(line: string) {
    const ts = new Date().toLocaleTimeString();
    setDiag((prev) => [`[${ts}] ${line}`, ...prev].slice(0, 80));
  }

  async function refreshInstances() {
    const res = await supabase.from("mc_openclaw_instances").select("id,name,gateway_ws_url,operator_token,created_at").order("created_at", { ascending: false });
    if (!res.error) setInstances((res.data ?? []) as any);
  }

  useEffect(() => {
    void refreshInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = instances.find((x) => x.id === conn.instanceId) ?? null;

  useEffect(() => {
    if (!selected) return;
    conn.setGatewayUrl(selected.gateway_ws_url);
    conn.setToken(selected.operator_token ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function createInstance() {
    setBusy(true);
    setTestStatus(null);
    try {
      const ins = await supabase
        .from("mc_openclaw_instances")
        .insert({
          name: instanceName.trim() || "OpenClaw",
          gateway_ws_url: conn.gatewayUrl.trim(),
          operator_token: conn.token.trim() || null
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      conn.setInstanceId(ins.data!.id);
      conn.save();
      setSavedAt(Date.now());
      await refreshInstances();
    } catch (e: any) {
      setTestStatus(e?.message ?? "Failed to save instance");
    } finally {
      setBusy(false);
    }
  }

  async function saveInstance() {
    if (!conn.instanceId) return void createInstance();
    setBusy(true);
    setTestStatus(null);
    try {
      const u = await supabase
        .from("mc_openclaw_instances")
        .update({
          name: instanceName.trim() || "OpenClaw",
          gateway_ws_url: conn.gatewayUrl.trim(),
          operator_token: conn.token.trim() || null
        })
        .eq("id", conn.instanceId);
      if (u.error) throw u.error;
      conn.save();
      setSavedAt(Date.now());
      await refreshInstances();
    } catch (e: any) {
      setTestStatus(e?.message ?? "Failed to update instance");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setTestStatus("Connecting…");
    setDiag([]);
    pushDiag(`WS URL: ${conn.gatewayUrl}`);
    pushDiag(`Token: ${conn.token ? "(set)" : "(empty)"}`);
    try {
      gwRef.current?.disconnect();
      const gw = new OpenClawGatewayClient({
        url: conn.gatewayUrl,
        token: conn.token,
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        client: { id: "mission-control", version: "0.1.0", platform: "web", mode: "operator", displayName: "Mission Control" }
      });
      gwRef.current = gw;
      const offClose = gw.on("connect.close", (evt) => {
        const p = evt.payload as any;
        pushDiag(`WS closed: code=${p?.code ?? "?"} reason=${p?.reason ?? ""}`);
      });
      const offShutdown = gw.on("shutdown", (evt) => pushDiag(`shutdown: ${JSON.stringify(evt.payload)}`));
      const offChallenge = gw.on("connect.challenge", () => pushDiag("connect.challenge received (pairing/identity may be required)"));
      const offHello = gw.on("hello-ok", (evt) => pushDiag(`hello-ok: ${JSON.stringify((evt.payload as any)?.server ?? {})}`));

      pushDiag("Opening WebSocket…");
      const hello = await gw.connect();
      pushDiag("Connected. Calling health…");
      const health = await gw.rpc<any>("health", {}).catch(() => null);
      offClose();
      offShutdown();
      offChallenge();
      offHello();
      setTestStatus(
        `Connected: protocol=${hello.protocol} server=${hello.server?.version ?? "unknown"} connId=${hello.server?.connId ?? "n/a"}${health ? " · health ok" : ""}`
      );
    } catch (e: any) {
      const msg = e?.message ?? "Failed to connect";
      pushDiag(`ERROR: ${msg}`);
      setTestStatus(e?.message ?? "Failed to connect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 860 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>OpenClaw instances</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Create named instances, validate connectivity, and assign projects to an instance. CoS/Agents/Workflows/Ops use the selected project’s instance automatically.
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Active instance</span>
          <select
            value={conn.instanceId ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              conn.setInstanceId(v);
              const row = instances.find((x) => x.id === v);
              if (row) {
                setInstanceName(row.name);
                conn.setGatewayUrl(row.gateway_ws_url);
                conn.setToken(row.operator_token ?? "");
              }
            }}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          >
            <option value="">(not saved yet)</option>
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Instance name</span>
          <input
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="e.g. Local WSL Gateway"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Gateway WS URL</span>
          <input
            value={conn.gatewayUrl}
            onChange={(e) => conn.setGatewayUrl(e.target.value)}
            placeholder="ws://127.0.0.1:18789"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Operator token</span>
          <input
            value={conn.token}
            onChange={(e) => conn.setToken(e.target.value)}
            placeholder="Paste token"
            autoComplete="off"
            type="password"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void pasteOperatorTokenFromClipboard(conn.setToken)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800, fontSize: 13 }}
          >
            Paste token
          </button>
          <button
            type="button"
            disabled={busy || !conn.gatewayUrl.trim()}
            onClick={() => void saveInstance()}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 900, fontSize: 13 }}
          >
            Save instance
          </button>
          <button
            type="button"
            disabled={busy || !conn.gatewayUrl.trim()}
            onClick={() => void testConnection()}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, fontSize: 13 }}
          >
            Validate connection
          </button>
          <button
            type="button"
            onClick={() => {
              conn.clear();
              setSavedAt(null);
              setTestStatus(null);
            }}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800, fontSize: 13 }}
          >
            Reset
          </button>
          {savedAt ? <div style={{ fontSize: 13, opacity: 0.75, alignSelf: "center" }}>Saved.</div> : null}
        </div>
        {testStatus ? (
          <div style={{ fontSize: 13, opacity: 0.9, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafafa" }}>
            {testStatus}
          </div>
        ) : null}
        {diag.length ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "white", padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Connection diagnostics</div>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(diag.slice().reverse().join("\n"))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 700 }}
              >
                Copy
              </button>
            </div>
            <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, maxHeight: 220, overflow: "auto" }}>
              {diag.slice().reverse().join("\n")}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

