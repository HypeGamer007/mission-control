"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { env } from "@/lib/env";
import { clearOpenClawConnection, loadOpenClawConnection, saveOpenClawConnection } from "@/lib/openclaw/connectionStore";

type Conn = {
  gatewayUrl: string;
  token: string;
  instanceId: string | null;
  setGatewayUrl: (v: string) => void;
  setToken: (v: string) => void;
  setInstanceId: (v: string | null) => void;
  save: () => void;
  clear: () => void;
};

const Ctx = createContext<Conn | null>(null);

export function OpenClawConnectionProvider(props: { children: React.ReactNode }) {
  const initial = useMemo(() => {
    const saved = loadOpenClawConnection();
    return {
      gatewayUrl: saved?.gatewayUrl || env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL,
      token: saved?.token || env.NEXT_PUBLIC_OPENCLAW_OPERATOR_TOKEN || "",
      instanceId: null as string | null
    };
  }, []);

  const [gatewayUrl, setGatewayUrl] = useState(initial.gatewayUrl);
  const [token, setToken] = useState(initial.token);
  const [instanceId, setInstanceId] = useState<string | null>(initial.instanceId);

  // Keep state in sync if localStorage changes in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "mc_openclaw_connection_v1") return;
      const s = loadOpenClawConnection();
      if (!s) return;
      setGatewayUrl(s.gatewayUrl);
      setToken(s.token);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback(() => saveOpenClawConnection({ gatewayUrl, token }), [gatewayUrl, token]);

  const value: Conn = {
    gatewayUrl,
    token,
    instanceId,
    setGatewayUrl,
    setToken,
    setInstanceId,
    save,
    clear: () => {
      clearOpenClawConnection();
      setGatewayUrl(env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL);
      setToken(env.NEXT_PUBLIC_OPENCLAW_OPERATOR_TOKEN || "");
      setInstanceId(null);
    }
  };

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useOpenClawConnection() {
  const v = useContext(Ctx);
  if (!v) throw new Error("OpenClawConnectionProvider missing");
  return v;
}

