"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { OpenClawGatewayClient } from "@/lib/openclaw/gatewayClient";
import { useProjectGatewayCredentials } from "@/lib/openclaw/useProjectGatewayCredentials";
import { pasteOperatorTokenFromClipboard } from "@/lib/openclaw/connectionUi";

type Project = { id: string; name: string; description: string | null; openclaw_gateway_ws_url: string | null };

export default function WorkflowsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const gwRef = useRef<OpenClawGatewayClient | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const { gatewayUrl, setGatewayUrl, token, setToken, refresh: reloadProjectCredentials } = useProjectGatewayCredentials(
    supabase,
    projectId || undefined
  );

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [output, setOutput] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await supabase.from("mc_projects").select("id,name,description,openclaw_gateway_ws_url").order("created_at", { ascending: false });
      if (!res.error) {
        setProjects((res.data ?? []) as any);
        const first = (res.data ?? [])[0] as any;
        if (first?.id) setProjectId(first.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectGateway() {
    const gw = new OpenClawGatewayClient({
      url: gatewayUrl,
      token,
      role: "operator",
      scopes: ["operator.read", "operator.write"],
      client: { id: "mission-control", version: "0.1.0", platform: "web", mode: "operator", displayName: "Mission Control" }
    });
    gwRef.current = gw;
    await gw.connect();
    return gw;
  }

  async function ensureDefaultSequence(projectIdArg: string, userId: string) {
    const existing = await supabase.from("mc_outreach_sequences").select("id,name").eq("project_id", projectIdArg).eq("name", "Default email").maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) return existing.data.id as string;
    const created = await supabase
      .from("mc_outreach_sequences")
      .insert({ project_id: projectIdArg, name: "Default email", channel: "email", steps: [{ step: 1, intent: "cold_outreach" }], created_by: userId })
      .select("id")
      .single();
    if (created.error) throw created.error;
    return created.data.id as string;
  }

  async function runEnrichAndDraft() {
    setBusy(true);
    setStatus(null);
    setOutput(null);
    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Select a project");

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated");

      // 1) Create lead
      const leadIns = await supabase
        .from("mc_leads")
        .insert({
          project_id: projectId,
          full_name: fullName || null,
          company: company || null,
          title: title || null,
          email: email || null,
          linkedin_url: linkedinUrl || null,
          status: "new",
          created_by: user.id
        })
        .select("id")
        .single();
      if (leadIns.error) throw leadIns.error;
      const leadId = leadIns.data.id as string;

      // 2) Attach provenance/source
      if (sourceUrl.trim()) {
        const srcIns = await supabase.from("mc_lead_sources").insert({ lead_id: leadId, kind: "url", url: sourceUrl.trim(), raw: {} });
        if (srcIns.error) throw srcIns.error;
      }

      // 3) Create an OpenClaw session + run a chat turn (enrichment + draft)
      const sessionKey = `wf_${leadId.replace(/-/g, "")}`;

      const gw = await connectGateway();
      await gw.rpc("sessions.create", { key: sessionKey, label: "workflow", task: "lead_enrich_and_email_draft" });
      await gw.rpc("sessions.messages.subscribe", { key: sessionKey });

      const prompt = buildPrompt({
        projectName: project.name,
        projectDescription: project.description,
        lead: {
          fullName,
          company,
          title,
          email,
          linkedinUrl,
          sourceUrl
        }
      });

      const runId = randomLocalId();
      setStatus("Running OpenClaw…");

      const finalText = await new Promise<string>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          off();
          reject(new Error("Timed out waiting for final response"));
        }, 120_000);

        const off = gw.on("chat", (evt) => {
          const p = evt.payload as any;
          if (!p || p.sessionKey !== sessionKey) return;
          if (p.state === "error") {
            window.clearTimeout(timeoutId);
            off();
            reject(new Error(p.errorMessage ?? "OpenClaw chat error"));
            return;
          }
          if (p.state === "final") {
            const text = messageToText(p.message);
            window.clearTimeout(timeoutId);
            off();
            resolve(text);
          }
        });

        void gw.rpc("chat.send", { sessionKey, message: prompt, deliver: false, idempotencyKey: runId });
      });

      const parsed = safeParseJson(finalText);
      const enrichmentSummary = typeof parsed?.enrichmentSummary === "string" ? parsed.enrichmentSummary : undefined;
      const subject = typeof parsed?.subject === "string" ? parsed.subject : undefined;
      const body = typeof parsed?.body === "string" ? parsed.body : finalText;

      // 4) Persist run + enrichment + outreach draft
      const runIns = await supabase.from("mc_agent_runs").insert({
        project_id: projectId,
        openclaw_session_key: sessionKey,
        kind: "draft_outreach",
        status: "succeeded",
        meta: { leadId },
        finished_at: new Date().toISOString()
      });
      if (runIns.error) throw runIns.error;

      const enrichIns = await supabase.from("mc_lead_enrichments").insert({
        lead_id: leadId,
        provider: "openclaw",
        summary: enrichmentSummary ?? null,
        data: { raw: finalText, parsed: parsed ?? null, prompt }
      });
      if (enrichIns.error) throw enrichIns.error;

      const seqId = await ensureDefaultSequence(projectId, user.id);
      const msgIns = await supabase.from("mc_outreach_messages").insert({
        sequence_id: seqId,
        lead_id: leadId,
        status: "draft",
        subject: subject ?? null,
        body: body ?? null,
        meta: { generatedBy: "openclaw", sessionKey }
      });
      if (msgIns.error) throw msgIns.error;

      setOutput({ leadId, sessionKey, enrichmentSummary, subject, body });
      setStatus("Done. Saved enrichment + draft email to Supabase.");
    } catch (e: any) {
      setStatus(e?.message ?? "Workflow failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Workflows</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>Marketing workflows that run OpenClaw and persist artifacts into Supabase.</div>
      </div>

      {status ? <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>{status}</div> : null}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>1) Select project + connect Gateway</div>
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
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>2) Lead + provenance</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="LinkedIn URL (optional)" style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Source URL (optional)" style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        </div>

        <button
          disabled={busy || !projectId || !gatewayUrl || !company}
          onClick={runEnrichAndDraft}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 900 }}
        >
          Run: enrich + draft email
        </button>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Requires at least Company + Project selected.</div>
      </div>

      {output ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Output (also saved to Supabase)</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>{JSON.stringify(output, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function buildPrompt(params: {
  projectName: string;
  projectDescription: string | null;
  lead: { fullName: string; company: string; title: string; email: string; linkedinUrl: string; sourceUrl: string };
}) {
  return [
    `You are the Chief of Staff for an enterprise marketing team.`,
    `Task: produce lead enrichment + a first-touch cold email draft.`,
    ``,
    `Return STRICT JSON only (no markdown, no prose) with keys:`,
    `- enrichmentSummary (string, 3-6 bullets as a single string)`,
    `- subject (string)`,
    `- body (string; plain text email; no markdown)`,
    ``,
    `Project: ${params.projectName}`,
    params.projectDescription ? `Project description: ${params.projectDescription}` : `Project description: (none provided)`,
    ``,
    `Lead:`,
    `- name: ${params.lead.fullName || "(unknown)"}`,
    `- company: ${params.lead.company || "(unknown)"}`,
    `- title: ${params.lead.title || "(unknown)"}`,
    `- email: ${params.lead.email || "(unknown)"}`,
    `- linkedin: ${params.lead.linkedinUrl || "(unknown)"}`,
    `- sourceUrl: ${params.lead.sourceUrl || "(none)"}`,
    ``,
    `Constraints:`,
    `- Do not invent facts about the person/company. If unknown, say unknown in enrichmentSummary.`,
    `- Email should focus on a likely pain point and a concrete next step.`,
    `- Keep body under 140 words.`,
  ].join("\n");
}

function messageToText(message: unknown): string {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  const m: any = message;
  if (typeof m.content === "string") return m.content;
  if (typeof m.text === "string") return m.text;
  if (typeof m.message === "string") return m.message;
  return JSON.stringify(message);
}

function safeParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function randomLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

