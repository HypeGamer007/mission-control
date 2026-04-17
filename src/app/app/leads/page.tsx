"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Project = { id: string; name: string };
type Lead = { id: string; project_id: string; status: string; full_name: string | null; company: string | null; title: string | null; email: string | null; created_at: string };

export default function LeadsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");

  async function refreshProjects() {
    const res = await supabase.from("mc_projects").select("id,name").order("created_at", { ascending: false });
    if (res.error) throw res.error;
    setProjects(res.data ?? []);
    if (!projectId && (res.data?.[0]?.id ?? "")) setProjectId(res.data![0]!.id);
  }

  const refreshLeads = useCallback(
    async (pid: string) => {
      if (!pid) return;
      const res = await supabase
        .from("mc_leads")
        .select("id,project_id,status,full_name,company,title,email,created_at")
        .eq("project_id", pid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (res.error) throw res.error;
      setLeads(res.data ?? []);
    },
    [supabase]
  );

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        await refreshProjects();
      } catch (e: any) {
        setError(e?.message ?? "Failed to load projects");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        await refreshLeads(projectId);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load leads");
      }
    })();
  }, [projectId, refreshLeads]);

  async function addLead() {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ins = await supabase.from("mc_leads").insert({
        project_id: projectId,
        full_name: fullName || null,
        company: company || null,
        title: title || null,
        email: email || null,
        created_by: user.id
      });
      if (ins.error) throw ins.error;
      setFullName("");
      setCompany("");
      setTitle("");
      setEmail("");
      await refreshLeads(projectId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to add lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Leads</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>This is the Supabase CRM view. The marketing workflows will write here.</div>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>
      ) : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Project</div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <option value="" disabled>
            Select project
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Add lead</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }} />
        </div>
        <button
          disabled={busy || !projectId}
          onClick={addLead}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#111827", color: "white", fontWeight: 700 }}
        >
          Add
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Recent leads</div>
        {leads.map((l) => (
          <div key={l.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>{l.full_name ?? "(Unnamed lead)"}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{l.status}</div>
            </div>
            <div style={{ opacity: 0.8, fontSize: 12 }}>
              {(l.title ?? "") + (l.title && l.company ? " @ " : "") + (l.company ?? "")}
            </div>
            {l.email ? <div style={{ opacity: 0.8, fontSize: 12 }}>{l.email}</div> : null}
            <div style={{ opacity: 0.6, fontSize: 12 }}>Created: {new Date(l.created_at).toLocaleString()}</div>
          </div>
        ))}
        {!leads.length ? <div style={{ opacity: 0.7 }}>No leads for this project yet.</div> : null}
      </div>
    </div>
  );
}

