import type { Json } from "@/integrations/supabase/types";

export type MandateLifecycleAction = "Activated" | "Deactivated";

export function parseMandateLifecycleLog(
  json: Json | null | undefined,
): Record<string, MandateLifecycleAction> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, MandateLifecycleAction> = {};
  for (const [k, v] of Object.entries(json)) {
    if (v === "Activated" || v === "Deactivated") out[k] = v;
  }
  return out;
}

export function mandateLifecycleLogCount(json: Json | null | undefined): number {
  return Object.keys(parseMandateLifecycleLog(json)).length;
}

export function appendMandateLifecycleEntry(
  existing: Json | null | undefined,
  active: boolean,
): Record<string, MandateLifecycleAction> {
  const parsed = parseMandateLifecycleLog(existing);
  const ts = new Date().toISOString();
  return { ...parsed, [ts]: active ? "Activated" : "Deactivated" };
}
