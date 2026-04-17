"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGatewayWsUrl, resolveOperatorToken } from "@/lib/openclaw/resolveGateway";

/**
 * Loads Gateway WS URL + operator token for a project (merged with env defaults).
 * Call `refresh` after saving credentials on the Projects page.
 */
export function useProjectGatewayCredentials(supabase: SupabaseClient, projectId: string | undefined) {
  const [gatewayUrl, setGatewayUrl] = useState(() => resolveGatewayWsUrl(null));
  const [token, setToken] = useState(() => resolveOperatorToken(undefined) ?? "");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setGatewayUrl(resolveGatewayWsUrl(null));
      const t = resolveOperatorToken(undefined);
      setToken(t ?? "");
      return;
    }
    setLoading(true);
    try {
      const res = await supabase
        .from("mc_projects")
        .select("openclaw_gateway_ws_url, openclaw_operator_token")
        .eq("id", projectId)
        .maybeSingle();
      const row = res.data as { openclaw_gateway_ws_url: string | null; openclaw_operator_token: string | null } | null;
      setGatewayUrl(resolveGatewayWsUrl(row?.openclaw_gateway_ws_url));
      const tok = resolveOperatorToken(row?.openclaw_operator_token);
      setToken(tok ?? "");
    } finally {
      setLoading(false);
    }
  }, [supabase, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    gatewayUrl,
    setGatewayUrl,
    token,
    setToken,
    loading,
    refresh
  };
}
