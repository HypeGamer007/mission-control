"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function UserMenu() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Account</div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await supabase.auth.signOut();
          window.location.href = "/login";
        }}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "white",
          fontWeight: 700
        }}
      >
        Sign out
      </button>
    </div>
  );
}

