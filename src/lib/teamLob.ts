import type { Team } from "@/hooks/useAuth";

export const STAFFING_LOB = "Staffing";
export const EXPERTS_LOB = "Awign Expert";

/** Canonical LoB list used across mandates, pipeline, and dashboards. */
export const ALL_LOB_OPTIONS = [
  "Diligence & Audit",
  "New Business Development",
  "Digital Gigs",
  EXPERTS_LOB,
  "Last Mile Operations",
  "Invigilation & Proctoring",
  STAFFING_LOB,
  "Others",
] as const;

export function normalizeLobForTeam(lob: string | null | undefined): string {
  return (lob || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function resolveTeamFromLob(
  lob: string | null | undefined,
): Team {
  const normalizedLob = normalizeLobForTeam(lob);
  if (normalizedLob === "staffing") {
    return "staffing";
  }
  if (normalizedLob === "awign expert" || normalizedLob === "awign experts") {
    return "experts";
  }
  return "ce";
}

/** Superadmin: all LoBs. CE: exclude Staffing & Awign Expert. Staffing/Experts: single LoB. */
export function getAllowedLobOptions(
  allLobs: readonly string[],
  team: Team | null,
  isGlobalAdmin: boolean,
): string[] {
  if (isGlobalAdmin) {
    return [...allLobs];
  }

  if (team === "staffing") {
    return allLobs.filter((lob) => normalizeLobForTeam(lob) === "staffing");
  }

  if (team === "experts") {
    return allLobs.filter((lob) => {
      const n = normalizeLobForTeam(lob);
      return n === "awign expert" || n === "awign experts";
    });
  }

  if (team === "ce") {
    return allLobs.filter((lob) => {
      const n = normalizeLobForTeam(lob);
      return n !== "staffing" && n !== "awign expert" && n !== "awign experts";
    });
  }

  return [...allLobs];
}

/** When set, LoB is fixed (no dropdown) for staffing / experts teams. */
export function getFixedLobForTeam(
  team: Team | null,
  isGlobalAdmin: boolean,
): string | null {
  if (isGlobalAdmin || !team) return null;
  if (team === "staffing") return STAFFING_LOB;
  if (team === "experts") return EXPERTS_LOB;
  return null;
}

export function isLobLockedForTeam(
  team: Team | null,
  isGlobalAdmin: boolean,
): boolean {
  return getFixedLobForTeam(team, isGlobalAdmin) !== null;
}

/** Dashboard LoB filter categories scoped by team. */
export function getLobDashboardCategories(
  team: Team | null,
  isGlobalAdmin: boolean,
): { id: string; label: string; lobs: string[] }[] {
  const all = [
    { id: "staffing", label: "Staffing", lobs: [STAFFING_LOB] },
    { id: "experts", label: "Experts", lobs: [EXPERTS_LOB] },
    {
      id: "ce",
      label: "CE",
      lobs: ALL_LOB_OPTIONS.filter(
        (l) => l !== STAFFING_LOB && l !== EXPERTS_LOB,
      ),
    },
  ];

  if (isGlobalAdmin) return all;
  if (team === "staffing") return [all[0]];
  if (team === "experts") return [all[1]];
  if (team === "ce") return [all[2]];
  return all;
}

/** Default selected LoBs for dashboard filter when team is locked. */
export function getDefaultDashboardLobs(
  team: Team | null,
  isGlobalAdmin: boolean,
): string[] {
  if (isGlobalAdmin) return [];
  const fixed = getFixedLobForTeam(team, isGlobalAdmin);
  if (fixed) return [fixed];
  return [];
}
