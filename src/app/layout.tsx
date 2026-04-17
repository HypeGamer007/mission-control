import type { ReactNode } from "react";

export const metadata = {
  title: "OpenClaw Mission Control",
  description: "Mission Control dashboard for OpenClaw + Supabase CRM."
};

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
        {props.children}
      </body>
    </html>
  );
}

