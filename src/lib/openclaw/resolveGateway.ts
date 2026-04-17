import { env } from "@/lib/env";

/** WebSocket URL: project override, else app default from env. */
export function resolveGatewayWsUrl(projectUrl: string | null | undefined): string {
  const u = projectUrl?.trim();
  return u || env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL;
}

/**
 * Operator token: project value wins, else optional env default.
 * Returns undefined when absent so Gateway client omits auth (if your Gateway allows that).
 */
export function resolveOperatorToken(projectToken: string | null | undefined): string | undefined {
  const t = projectToken?.trim();
  if (t) return t;
  const e = env.NEXT_PUBLIC_OPENCLAW_OPERATOR_TOKEN?.trim();
  return e || undefined;
}
