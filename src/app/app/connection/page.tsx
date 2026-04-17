"use client";

import { useState } from "react";
import { useOpenClawConnection } from "@/lib/openclaw/OpenClawConnectionContext";
import { pasteOperatorTokenFromClipboard } from "@/lib/openclaw/connectionUi";

export default function ConnectionPage() {
  const conn = useOpenClawConnection();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 860 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>OpenClaw instance</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Set the Gateway WebSocket URL and operator token once. CoS, Agents, Workflows, and Ops will use this connection.
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
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
            onClick={() => {
              conn.save();
              setSavedAt(Date.now());
            }}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 900, fontSize: 13 }}
          >
            Save connection
          </button>
          <button
            type="button"
            onClick={() => {
              conn.clear();
              setSavedAt(null);
            }}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 800, fontSize: 13 }}
          >
            Reset
          </button>
          {savedAt ? <div style={{ fontSize: 13, opacity: 0.75, alignSelf: "center" }}>Saved.</div> : null}
        </div>
      </div>
    </div>
  );
}

