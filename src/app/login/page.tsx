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
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function signIn() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = next;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unable to sign in. Check your email and password.";
      setStatus(msg);
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
      setStatus("Account created. If your organization requires email verification, check your inbox before signing in.");
      setMode("signin");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unable to create an account.";
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") void signIn();
    else void signUp();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
        background: "linear-gradient(165deg, #f8fafc 0%, #eef2ff 45%, #f1f5f9 100%)",
        color: "#0f172a"
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#6366f1"
            }}
          >
            Mission Control
          </div>
          <h1 style={{ margin: "12px 0 0", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            Welcome back
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 15, color: "#64748b", lineHeight: 1.5 }}>
            Sign in to your workspace to manage projects, agents, and campaigns.
          </p>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.06), 0 10px 24px -8px rgb(15 23 42 / 0.12)",
            padding: "28px 28px 24px"
          }}
        >
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 18 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Work email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                type="email"
                required
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 15,
                  outline: "none",
                  transition: "border-color 0.15s"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 15,
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
              />
            </label>

            {status ? (
              <div
                role="status"
                style={{
                  fontSize: 13,
                  lineHeight: 1.45,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: status.includes("created") || status.includes("inbox") ? "#ecfdf5" : "#fef2f2",
                  color: status.includes("created") || status.includes("inbox") ? "#065f46" : "#991b1b",
                  border: `1px solid ${status.includes("created") || status.includes("inbox") ? "#a7f3d0" : "#fecaca"}`
                }}
              >
                {status}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !email || !password}
              style={{
                marginTop: 4,
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: busy ? "#a5b4fc" : "#4f46e5",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: busy ? "wait" : "pointer"
              }}
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid #f1f5f9",
              textAlign: "center",
              fontSize: 14,
              color: "#64748b"
            }}
          >
            {mode === "signin" ? (
              <>
                New to Mission Control?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setStatus(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#4f46e5",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2
                  }}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have access?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setStatus(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#4f46e5",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2
                  }}
                >
                  Sign in instead
                </button>
              </>
            )}
          </div>
        </div>

        <p style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
          Encrypted session · Only invited team members can access this workspace.
        </p>
      </div>
    </div>
  );
}
