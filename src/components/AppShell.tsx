"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { UserMenu } from "@/components/UserMenu";
import { CosChatDock } from "@/components/CosChatDock";

const navItems = [
  { href: "/app", label: "Overview" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/workflows", label: "Workflows" },
  { href: "/app/ops", label: "Ops" }
];

export function AppShell(props: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateColumns: "240px 1fr 420px" }}>
      <aside style={{ borderRight: "1px solid #e5e7eb", padding: 14, overflow: "auto" }}>
        <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>Mission Control</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Campaigns & agent ops</div>

        <nav style={{ marginTop: 16, display: "grid", gap: 6 }}>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(active && "active")}
                style={{
                  textDecoration: "none",
                  color: "#111827",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 10px",
                  background: active ? "#eef2ff" : "white",
                  fontWeight: active ? 700 : 600
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 16 }}>
          <UserMenu />
        </div>
      </aside>

      <main style={{ overflow: "auto" }}>{props.children}</main>

      <aside style={{ borderLeft: "1px solid #e5e7eb", overflow: "auto" }}>
        <CosChatDock />
      </aside>
    </div>
  );
}

