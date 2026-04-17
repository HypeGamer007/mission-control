"use client";

type ConnState = { gatewayUrl: string; token: string };

const KEY = "mc_openclaw_connection_v1";

export function loadOpenClawConnection(): ConnState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConnState>;
    if (typeof parsed.gatewayUrl !== "string") return null;
    if (typeof parsed.token !== "string") return null;
    return { gatewayUrl: parsed.gatewayUrl, token: parsed.token };
  } catch {
    return null;
  }
}

export function saveOpenClawConnection(next: ConnState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify({ gatewayUrl: next.gatewayUrl, token: next.token }));
}

export function clearOpenClawConnection() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

