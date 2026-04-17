"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/app";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = next;
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to sign in");
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setStatus("Signed up. If email confirmation is enabled, check your inbox.");
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to sign up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b1020", color: "#e7e9ee" }}>
      <div style={{ width: 420, maxWidth: "92vw", border: "1px solid #283056", borderRadius: 12, padding: 20, background: "#0f1631" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Mission Control</div>
        <div style={{ opacity: 0.8, marginTop: 6 }}>Sign in with Supabase</div>

        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #283056", background: "#0b1020", color: "#e7e9ee" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #283056", background: "#0b1020", color: "#e7e9ee" }}
            />
          </label>

          {status ? <div style={{ fontSize: 12, color: "#f3b7b7" }}>{status}</div> : null}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={signIn}
              disabled={busy || !email || !password}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #2e3a66", background: "#2a5bd7", color: "white", fontWeight: 600 }}
            >
              Sign in
            </button>
            <button
              onClick={signUp}
              disabled={busy || !email || !password}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #283056", background: "#0b1020", color: "#e7e9ee", fontWeight: 600 }}
            >
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

