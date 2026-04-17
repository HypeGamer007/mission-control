import type { SupabaseClient } from "@supabase/supabase-js";

export type OpenClawCreds = { gatewayUrl: string; token: string; instanceName?: string };

/**
 * Resolve OpenClaw credentials for a project.
 * If the project has `openclaw_instance_id`, use that instance row; otherwise fall back to the active UI connection.
 */
export async function resolveProjectOpenClawCreds(
  supabase: SupabaseClient,
  projectId: string | undefined,
  fallback: { gatewayUrl: string; token: string }
): Promise<OpenClawCreds> {
  if (!projectId) return { gatewayUrl: fallback.gatewayUrl, token: fallback.token };

  const p = await supabase.from("mc_projects").select("openclaw_instance_id").eq("id", projectId).maybeSingle();
  const instanceId = (p.data as any)?.openclaw_instance_id as string | null | undefined;
  if (!instanceId) return { gatewayUrl: fallback.gatewayUrl, token: fallback.token };

  const inst = await supabase
    .from("mc_openclaw_instances")
    .select("name,gateway_ws_url,operator_token")
    .eq("id", instanceId)
    .maybeSingle();

  const row = inst.data as any;
  const gatewayUrl = String(row?.gateway_ws_url ?? "").trim();
  const token = String(row?.operator_token ?? "").trim();
  if (!gatewayUrl) return { gatewayUrl: fallback.gatewayUrl, token: fallback.token };
  return { gatewayUrl, token, instanceName: row?.name ? String(row.name) : undefined };
}

