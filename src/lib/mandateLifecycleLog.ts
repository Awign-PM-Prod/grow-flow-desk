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

/**
 * Whether the mandate was Active at a given instant, for dashboard-style point-in-time counts.
 * Baseline: Active from `created_at` (first activation) until overridden by lifecycle_status_log
 * entries with timestamp <= `asOf` (inclusive), applied in chronological order.
 */
export function isMandateActiveAsOf(
  createdAt: string | null | undefined,
  lifecycleLog: Json | null | undefined,
  asOf: Date,
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(asOf.getTime())) return false;
  if (created > asOf) return false;

  let active = true;
  const log = parseMandateLifecycleLog(lifecycleLog);
  const keys = Object.keys(log).sort((a, b) => a.localeCompare(b));
  for (const ts of keys) {
    const t = new Date(ts);
    if (Number.isNaN(t.getTime())) continue;
    if (t <= asOf) {
      active = log[ts] === "Activated";
    }
  }
  return active;
}
