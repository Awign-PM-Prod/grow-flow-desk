import type { Team } from "@/hooks/useAuth";
import { TEAM_LABELS } from "@/lib/teamLabels";

export const EXPERTS_LOB = "Awign Expert";
export const INSTALLATION_AND_MAINTENANCE_LOB = "Installation & Maintenance";
export const AI_OPERATIONS_LOB = "AI Operations";

/** The 3-way staffing split. */
export const STAFFING_ANCHAL_LOB = "Staffing (Anchal)";
export const STAFFING_PRASHANT_LOB = "Staffing (Prashant)";
export const STAFFING_CORE_LOB = "Staffing (Core)";
export const STAFFING_LOBS = [
  STAFFING_ANCHAL_LOB,
  STAFFING_PRASHANT_LOB,
  STAFFING_CORE_LOB,
] as const;
/** Staffing LoBs used by new-business mandate types (New Acquisition / New Cross Sell). */
export const STAFFING_NEW_BUSINESS_LOBS = [
  STAFFING_ANCHAL_LOB,
  STAFFING_PRASHANT_LOB,
] as const;
/** Staffing LoB reserved for Existing-type mandates. */
export const STAFFING_EXISTING_LOB = STAFFING_CORE_LOB;

/** Legacy staffing LoB labels kept only for recognising pre-migration rows. */
const LEGACY_STAFFING_LOBS = ["staffing", "new business line"];

/** Canonical LoB list used across mandates, pipeline, and dashboards. */
export const ALL_LOB_OPTIONS = [
  "Diligence & Audit",
  "New Business Development",
  AI_OPERATIONS_LOB,
  EXPERTS_LOB,
  "Last Mile Operations",
  "Invigilation & Proctoring",
  INSTALLATION_AND_MAINTENANCE_LOB,
  STAFFING_ANCHAL_LOB,
  "Others",
  STAFFING_PRASHANT_LOB,
  STAFFING_CORE_LOB,
] as const;

export function normalizeLobForTeam(lob: string | null | undefined): string {
  return (lob || "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** True for any staffing LoB, including legacy pre-migration labels. */
export function isStaffingLob(lob: string | null | undefined): boolean {
  const n = normalizeLobForTeam(lob);
  return (
    n === "staffing (anchal)" ||
    n === "staffing (prashant)" ||
    n === "staffing (core)" ||
    LEGACY_STAFFING_LOBS.includes(n)
  );
}

export function isExpertsLob(lob: string | null | undefined): boolean {
  const n = normalizeLobForTeam(lob);
  return n === "awign expert" || n === "awign experts";
}

export function resolveTeamFromLob(
  lob: string | null | undefined,
): Team {
  if (isStaffingLob(lob)) {
    return "staffing";
  }
  if (isExpertsLob(lob)) {
    return "experts";
  }
  return "ce";
}

/** Superadmin: all LoBs. CE: all except Awign Expert. Staffing: Staffing + New Business Line. Experts: single LoB. */
export function getAllowedLobOptions(
  allLobs: readonly string[],
  team: Team | null,
  isGlobalAdmin: boolean,
): string[] {
  if (isGlobalAdmin) {
    return [...allLobs];
  }

  if (team === "staffing") {
    return allLobs.filter((lob) => isStaffingLob(lob));
  }

  if (team === "experts") {
    return allLobs.filter((lob) => isExpertsLob(lob));
  }

  if (team === "ce") {
    return allLobs.filter((lob) => !isExpertsLob(lob) && !isStaffingLob(lob));
  }

  return [...allLobs];
}

/**
 * Mandate-type ↔ staffing-LoB rules:
 *  - Staffing (Core) is Existing-only.
 *  - Staffing (Anchal) / Staffing (Prashant) are New Acquisition / New Cross Sell only.
 *  - All other LoBs allow any type.
 */
export function getAllowedMandateTypesForLob(
  lob: string | null | undefined,
  allTypes: readonly string[],
): string[] {
  const n = normalizeLobForTeam(lob);
  if (n === "staffing (core)") {
    return allTypes.filter((t) => t === "Existing");
  }
  if (n === "staffing (anchal)" || n === "staffing (prashant)") {
    return allTypes.filter((t) => t !== "Existing");
  }
  return [...allTypes];
}

/** Filter LoB options for the currently selected mandate type (mirror of the rule above). */
export function filterLobOptionsForMandateType(
  lobs: readonly string[],
  type: string | null | undefined,
): string[] {
  if (type === "Existing") {
    return lobs.filter((l) => {
      const n = normalizeLobForTeam(l);
      return n !== "staffing (anchal)" && n !== "staffing (prashant)";
    });
  }
  if (type === "New Acquisition" || type === "New Cross Sell") {
    return lobs.filter((l) => normalizeLobForTeam(l) !== "staffing (core)");
  }
  return [...lobs];
}

export function isValidTeam(value: string | null | undefined): value is Team {
  return value === "ce" || value === "staffing" || value === "experts";
}

/** Mandate team from creator profile (KAM) or selected KAM (admin/manager). */
export function resolveMandateTeam(args: {
  creatorIsKam: boolean;
  creatorTeam: Team | null;
  selectedKamId: string | null | undefined;
  kamTeamById: Record<string, Team | null | undefined>;
}): Team | null {
  if (args.creatorIsKam) {
    return args.creatorTeam;
  }
  const kamId = args.selectedKamId?.trim();
  if (kamId) {
    const kamTeam = args.kamTeamById[kamId];
    if (isValidTeam(kamTeam)) {
      return kamTeam;
    }
  }
  return args.creatorTeam;
}

export function shouldShowStaffingMandateFields(
  effectiveTeam: Team | null,
): boolean {
  return effectiveTeam === "staffing";
}

/** CE mandates collect handover info; staffing and experts teams do not. */
export function shouldShowHandoverInfo(
  effectiveTeam: Team | null,
): boolean {
  return effectiveTeam !== "staffing" && effectiveTeam !== "experts";
}

/** When set, LoB is fixed (no dropdown). Staffing team picks Staffing vs New Business Line. */
export function getFixedLobForTeam(
  team: Team | null,
  isGlobalAdmin: boolean,
): string | null {
  if (isGlobalAdmin || !team) return null;
  if (team === "experts") return EXPERTS_LOB;
  return null;
}

export function isLobLockedForTeam(
  team: Team | null,
  isGlobalAdmin: boolean,
): boolean {
  return getFixedLobForTeam(team, isGlobalAdmin) !== null;
}

/** LoBs hidden from dashboard filters and chart axes. */
export const DASHBOARD_HIDDEN_LOBS: readonly string[] = [];

export function filterDashboardVisibleLobs(lobs: readonly string[]): string[] {
  const hidden = new Set<string>(DASHBOARD_HIDDEN_LOBS);
  return lobs.filter((l) => !hidden.has(l));
}

/** Map mandate LoB to a visible dashboard chart bucket (handles legacy staffing labels). */
export function resolveDashboardChartLobKey(
  lob: string | null | undefined,
  visibleLobs: readonly string[],
): string | null {
  let raw = (lob && String(lob).trim()) || "";
  if (!raw) return null;
  // Legacy single-Staffing / New Business Line rows roll into Staffing (Prashant).
  if (
    !visibleLobs.includes(raw) &&
    isStaffingLob(raw) &&
    visibleLobs.includes(STAFFING_PRASHANT_LOB)
  ) {
    raw = STAFFING_PRASHANT_LOB;
  }
  if (visibleLobs.includes(raw)) return raw;
  if (visibleLobs.includes("Others")) return "Others";
  return null;
}

/** DB LoB values to match when a visible LoB filter is applied (include legacy labels). */
export function expandDashboardLobFilterValues(selectedLobs: string[]): string[] {
  const out = new Set<string>();
  for (const lob of selectedLobs) {
    out.add(lob);
    if (isStaffingLob(lob)) {
      out.add("Staffing");
      out.add("New Business Line");
    }
  }
  return [...out];
}

/** LoB list for dashboard charts and LoB filter, scoped by team selector (admin) or user team. */
export function getChartLobOptionsForDashboard(
  allLobs: readonly string[],
  args: {
    canSelectAllTeams: boolean;
    selectedTeam: "all" | Team | null;
    userTeam: Team | null;
  },
): string[] {
  const { canSelectAllTeams, selectedTeam, userTeam } = args;
  let scoped: string[];
  if (canSelectAllTeams) {
    if (selectedTeam === "all" || !selectedTeam) {
      scoped = [...allLobs];
    } else {
      scoped = getAllowedLobOptions(allLobs, selectedTeam, false);
    }
  } else {
    scoped = getAllowedLobOptions(allLobs, userTeam, false);
  }
  return filterDashboardVisibleLobs(scoped);
}

/** Dashboard LoB filter categories; when admin picks a team, only that team's category. */
export function getLobDashboardCategoriesForFilter(
  userTeam: Team | null,
  canSelectAllTeams: boolean,
  selectedTeam: "all" | Team | null,
): { id: string; label: string; lobs: string[] }[] {
  if (canSelectAllTeams && selectedTeam && selectedTeam !== "all") {
    return getLobDashboardCategories(selectedTeam, false);
  }
  return getLobDashboardCategories(userTeam, canSelectAllTeams);
}

/** CE dashboard filter category — excludes LoBs owned by staffing/experts categories. */
export function getCeDashboardCategoryLobs(): string[] {
  return ALL_LOB_OPTIONS.filter((l) => !isExpertsLob(l) && !isStaffingLob(l));
}

/** Dashboard LoB filter categories scoped by team. */
export function getLobDashboardCategories(
  team: Team | null,
  isGlobalAdmin: boolean,
): { id: string; label: string; lobs: string[] }[] {
  const all = [
    {
      id: "staffing",
      label: TEAM_LABELS.staffing,
      lobs: [...STAFFING_LOBS],
    },
    { id: "experts", label: TEAM_LABELS.experts, lobs: [EXPERTS_LOB] },
    {
      id: "ce",
      label: TEAM_LABELS.ce,
      lobs: getCeDashboardCategoryLobs(),
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
  if (team === "staffing") return [];
  const fixed = getFixedLobForTeam(team, isGlobalAdmin);
  if (fixed) return [fixed];
  return [];
}
