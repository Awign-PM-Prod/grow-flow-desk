import type { Team } from "@/hooks/useAuth";

/** Display labels for team values (UI only — DB values stay ce/staffing/experts). */
export const TEAM_LABELS: Record<Team, string> = {
  ce: "Core Team",
  staffing: "Staffing (Prashant)",
  experts: "Experts",
};

export const TEAM_SELECT_OPTIONS: { value: Team; label: string }[] = [
  { value: "ce", label: TEAM_LABELS.ce },
  { value: "staffing", label: TEAM_LABELS.staffing },
  { value: "experts", label: TEAM_LABELS.experts },
];

export function formatTeamLabel(team: string | null | undefined): string {
  if (!team) return "—";
  if (team === "ce" || team === "staffing" || team === "experts") {
    return TEAM_LABELS[team];
  }
  return team;
}

/** Parse UI or legacy CSV team strings into canonical team values. */
export function parseTeamValue(value: string | undefined): Team | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "ce" || normalized === "core team") return "ce";
  if (normalized === "staffing" || normalized === "staffing (prashant)") return "staffing";
  if (normalized === "experts") return "experts";
  return null;
}

export const TEAM_CSV_HINT =
  `${TEAM_LABELS.ce}, ${TEAM_LABELS.staffing}, or ${TEAM_LABELS.experts}`;
