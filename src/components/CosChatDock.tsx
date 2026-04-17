"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { OpenClawGatewayClient } from "@/lib/openclaw/gatewayClient";

type Project = { id: string; name: string; openclaw_gateway_ws_url: string | null };
type ChatRow = { id: string; ts: number; role: "user" | "assistant" | "system"; label?: string; content: string };

export function CosChatDock() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const gatewayRef = useRef<OpenClawGatewayClient | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [gatewayUrl, setGatewayUrl] = useState(env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL);
  const [token, setToken] = useState(env.NEXT_PUBLIC_OPENCLAW_OPERATOR_TOKEN ?? "");

  const [sessionKey, setSessionKey] = useState<string>("");
  const [status, setStatus] = useState<string>("disconnected");
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const res = await supabase.from("mc_projects").select("id,name,openclaw_gateway_ws_url").order("created_at", { ascending: false });
      if (!res.error) {
        setProjects((res.data ?? []) as any);
        const first = (res.data ?? [])[0] as any;
        if (first?.id) {
          setProjectId(first.id);
          if (first.openclaw_gateway_ws_url) setGatewayUrl(first.openclaw_gateway_ws_url);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = projects.find((x) => x.id === projectId);
    if (p?.openclaw_gateway_ws_url) setGatewayUrl(p.openclaw_gateway_ws_url);
  }, [projectId, projects]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rows.length]);

  async function connectCos() {
    if (!projectId) return;
    setBusy(true);
    setStatus("connecting…");
    try {
      const session = `cos_${projectId.replace(/-/g, "")}`;
      setSessionKey(session);

      const gw = new OpenClawGatewayClient({
        url: gatewayUrl,
        token,
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        client: { id: "mission-control", version: "0.1.0", platform: "web", mode: "operator", displayName: "Mission Control" }
      });
      gatewayRef.current = gw;

      gw.on("tick", () => setStatus("connected"));
      gw.on("shutdown", (evt) => setStatus(`shutdown: ${(evt.payload as any)?.reason ?? "unknown"}`));

      gw.on("session.message", (evt) => {
        const p = evt.payload as any;
        if (!p || p.sessionKey !== session) return;
        const msg = p.message ?? {};
        const role = (msg.role as any) === "assistant" ? "assistant" : (msg.role as any) === "user" ? "user" : "system";
        const content = String(msg.content ?? "");
        if (!content) return;
        setRows((prev) => [
          ...prev,
          {
            id: `sm_${p.messageSeq ?? Date.now()}_${Math.random().toString(16).slice(2)}`,
            ts: Date.now(),
            role,
            label: msg.senderLabel ? String(msg.senderLabel) : undefined,
            content
          }
        ]);
      });

      gw.on("chat", (evt) => {
        // `chat` events are used by the WebChat runner; payload is intentionally opaque here.
        // We still show deltas/finals if the payload includes a string-like message.
        const p = evt.payload as any;
        if (!p || p.sessionKey !== session) return;
        const m = p.message;
        if (typeof m === "string" && m.trim()) {
          setRows((prev) => [...prev, { id: `chat_${p.seq ?? Date.now()}`, ts: Date.now(), role: "assistant", content: m }]);
        } else if (m && typeof m === "object") {
          const text = (m.content ?? m.text ?? "") as any;
          if (typeof text === "string" && text.trim()) {
            setRows((prev) => [...prev, { id: `chat_${p.seq ?? Date.now()}`, ts: Date.now(), role: "assistant", content: text }]);
          }
        }
      });

      await gw.connect();

      // Ensure the session exists.
      await gw.rpc("sessions.create", { key: session, label: "cos", message: "Mission Control connected. You are the Chief of Staff." });
      await gw.rpc("sessions.messages.subscribe", { key: session });

      // Load some bounded history for display.
      const history = await gw.rpc<any>("chat.history", { sessionKey: session, limit: 200 });
      const items: ChatRow[] = [];
      const rowsRaw = (history?.messages ?? history?.rows ?? history?.history ?? []) as any[];
      for (const r of rowsRaw) {
        const role = (r.role as any) === "assistant" ? "assistant" : (r.role as any) === "user" ? "user" : "system";
        const content = String(r.content ?? r.text ?? r.message ?? "");
        if (!content) continue;
        items.push({ id: `h_${items.length}`, ts: Date.now(), role, content });
      }
      if (items.length) setRows(items);

      setStatus("connected");
    } catch (e: any) {
      setStatus(e?.message ?? "failed to connect");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const gw = gatewayRef.current;
    if (!gw || !gw.isConnected() || !sessionKey) return;
    const msg = draft.trim();
    if (!msg) return;
    setDraft("");

    setRows((prev) => [...prev, { id: randomLocalId(), ts: Date.now(), role: "user", content: msg }]);
    try {
      await gw.rpc("sessions.send", { key: sessionKey, message: msg, idempotencyKey: randomLocalId() });
    } catch (e: any) {
      setRows((prev) => [...prev, { id: randomLocalId(), ts: Date.now(), role: "system", content: `Send failed: ${e?.message ?? "unknown error"}` }]);
    }
  }

  return (
    <div style={{ padding: 14, display: "grid", gridTemplateRows: "auto auto 1fr auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900 }}>Chief of Staff</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{status}</div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <option value="" disabled>
            Select project
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          placeholder="Gateway WS URL"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Operator token"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
        <button
          disabled={busy || !projectId || !gatewayUrl}
          onClick={connectCos}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
      </div>

      <div ref={scrollRef} style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, overflow: "auto" }}>
        {!rows.length ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Connect to your Gateway, then chat with the CoS. This chat is backed by the OpenClaw session key `{sessionKey || "(not set)"}`.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {r.role}
                  {r.label ? ` (${r.label})` : ""}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{r.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Message the CoS…"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
        <button onClick={send} disabled={!draft.trim() || status !== "connected"} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}>
          Send
        </button>
      </div>
    </div>
  );
}

function randomLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input
          disabled
          placeholder="Message the CoS…"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb" }}
        />
        <button disabled style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 800 }}>
          Send
        </button>
      </div>
    </div>
  );
}

