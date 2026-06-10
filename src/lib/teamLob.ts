import type { Team } from "@/hooks/useAuth";
import { TEAM_LABELS } from "@/lib/teamLabels";

export const STAFFING_LOB = "Staffing";
export const EXPERTS_LOB = "Awign Expert";
export const NEW_BUSINESS_LINE_LOB = "New Business Line";
export const INSTALLATION_AND_MAINTENANCE_LOB = "Installation and maintenance";
export const AI_OPS_LOB = "AI Ops";

/** Canonical LoB list used across mandates, pipeline, and dashboards. */
export const ALL_LOB_OPTIONS = [
  "Diligence & Audit",
  "New Business Development",
  NEW_BUSINESS_LINE_LOB,
  "Digital Gigs",
  INSTALLATION_AND_MAINTENANCE_LOB,
  AI_OPS_LOB,
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
    return allLobs.filter((lob) => {
      const n = normalizeLobForTeam(lob);
      return n === "staffing" || n === "new business line";
    });
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
      return n !== "awign expert" && n !== "awign experts";
    });
  }

  return [...allLobs];
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
  if (canSelectAllTeams) {
    if (selectedTeam === "all" || !selectedTeam) {
      return [...allLobs];
    }
    return getAllowedLobOptions(allLobs, selectedTeam, false);
  }
  return getAllowedLobOptions(allLobs, userTeam, false);
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

/** Dashboard LoB filter categories scoped by team. */
export function getLobDashboardCategories(
  team: Team | null,
  isGlobalAdmin: boolean,
): { id: string; label: string; lobs: string[] }[] {
  const all = [
    {
      id: "staffing",
      label: TEAM_LABELS.staffing,
      lobs: [STAFFING_LOB, NEW_BUSINESS_LINE_LOB],
    },
    { id: "experts", label: TEAM_LABELS.experts, lobs: [EXPERTS_LOB] },
    {
      id: "ce",
      label: TEAM_LABELS.ce,
      lobs: ALL_LOB_OPTIONS.filter((l) => l !== EXPERTS_LOB),
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
