import type { ReactNode } from "react";

export const metadata = {
  title: "Sign in · Mission Control",
  description: "Secure access to your Mission Control workspace."
};

export default function LoginLayout(props: { children: ReactNode }) {
  return props.children;
}
