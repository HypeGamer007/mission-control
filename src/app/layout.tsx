import type { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Mission Control",
  description: "Operator console for campaigns, leads, and AI agents."
};

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body style={{ margin: 0 }}>{props.children}</body>
    </html>
  );
}

