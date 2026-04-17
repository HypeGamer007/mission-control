export default function AppHomePage() {
  return (
    <div style={{ padding: 16, display: "grid", gap: 16, maxWidth: 900 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Dashboard</div>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          Pick a project from the CoS dock or Projects, then use the right-hand Chief of Staff chat, Agents, Workflows, and Ops against your OpenClaw Gateway.
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fafafa",
          display: "grid",
          gap: 12
        }}
      >
        <div style={{ fontWeight: 800 }}>How Mission Control ties to an OpenClaw instance</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, opacity: 0.92 }}>
          An <strong>OpenClaw instance</strong> is whatever is listening on your <strong>Gateway WebSocket URL</strong> (plus its config, operator token, and any nodes/agents it manages). Mission Control does not host that process; the browser opens a WebSocket to it from this app.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55, opacity: 0.92, display: "grid", gap: 8 }}>
          <li>
            <strong>Connection</strong> — Gateway URL and operator token default from <code>.env.local</code>. Each project can store its own <strong>Gateway WS URL</strong> and <strong>operator token</strong> (Projects page); CoS, Workflows, Agents, and Ops load those when you select the project, with env as fallback. Tokens are visible to project members in the browser when connecting—treat them as shared secrets.
          </li>
          <li>
            <strong>Getting a token</strong> — OpenClaw does not expose a standard browser API to “discover” the operator token automatically; it comes from your Gateway config. Use <strong>Paste token</strong> on connection panels after copying from your terminal or config once, or save it on the project so the whole team can reload it with <strong>Reload from project</strong>.
          </li>
          <li>
            <strong>Chief of Staff chat (right dock)</strong> — After you connect, the dock creates a Gateway <strong>session</strong> (key like <code>cos_…</code>) and streams messages over the same WebSocket. That is live OpenClaw chat, not Supabase realtime.
          </li>
          <li>
            <strong>Agents</strong> — Listed and created via Gateway RPC (<code>agents.list</code>, <code>agents.create</code>). Agent <strong>teams</strong> in Supabase map to OpenClaw <code>workspace</code> strings so you can filter and group workers in the UI.
          </li>
          <li>
            <strong>Workflows</strong> — Uses the Gateway for a chat turn (enrichment / draft), while leads and drafts are saved in Postgres under the selected project.
          </li>
          <li>
            <strong>Supabase</strong> — Holds org data (teams, projects, leads, agent teams, audit). RLS scopes it to signed-in members; it does not replace the Gateway for sessions or agent RPCs.
          </li>
        </ul>
      </div>
    </div>
  );
}
