import type { SupabaseClient } from "@supabase/supabase-js";

export type TestProfileExclusions = {
  kamIds: Set<string>;
  nsoEmails: Set<string>;
};

export async function fetchTestProfileExclusions(
  supabase: SupabaseClient,
): Promise<TestProfileExclusions> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("test_account", true);

  if (error) {
    console.error("Failed to load test profile exclusions:", error);
    return { kamIds: new Set(), nsoEmails: new Set() };
  }

  const kamIds = new Set<string>();
  const nsoEmails = new Set<string>();
  for (const profile of data ?? []) {
    kamIds.add(profile.id);
    if (profile.role === "nso" && profile.email) {
      nsoEmails.add(profile.email.trim().toLowerCase());
    }
  }
  return { kamIds, nsoEmails };
}

/** Exclude rows assigned to test KAMs (null kam_id still included). */
export function applyExcludeTestKamFilter(
  query: any,
  excludedKamIds: Set<string>,
  column = "kam_id",
): any {
  if (excludedKamIds.size === 0) return query;
  const idList = [...excludedKamIds].join(",");
  return query.or(`${column}.is.null,${column}.not.in.(${idList})`);
}

export function filterRowsByTestProfiles<
  T extends { kam_id?: string | null; new_sales_owner?: string | null },
>(rows: T[] | null | undefined, exclusions: TestProfileExclusions): T[] {
  return (rows ?? []).filter((row) => {
    if (row.kam_id && exclusions.kamIds.has(row.kam_id)) return false;
    const nso = row.new_sales_owner?.trim().toLowerCase();
    if (nso && exclusions.nsoEmails.has(nso)) return false;
    return true;
  });
}

export function filterTargetsByTestProfiles<
  T extends {
    kam_id?: string | null;
    nso_mail_id?: string | null;
    mandates?: { kam_id?: string | null } | { kam_id?: string | null }[] | null;
  },
>(targets: T[] | null | undefined, exclusions: TestProfileExclusions): T[] {
  return (targets ?? []).filter((target) => {
    if (target.kam_id && exclusions.kamIds.has(target.kam_id)) return false;
    const nso = target.nso_mail_id?.trim().toLowerCase();
    if (nso && exclusions.nsoEmails.has(nso)) return false;
    const mandate = Array.isArray(target.mandates)
      ? target.mandates[0]
      : target.mandates;
    if (mandate?.kam_id && exclusions.kamIds.has(mandate.kam_id)) return false;
    return true;
  });
}
