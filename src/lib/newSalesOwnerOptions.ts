import type { Team } from "@/hooks/useAuth";

export type NewSalesOwnerSource = "kam" | "nso";

export type NewSalesOwnerKam = {
  id: string;
  email: string;
  full_name: string | null;
  team: Team | null;
};

export type NewSalesOwnerNso = {
  id: string;
  email: string;
  full_name: string | null;
};

export type NewSalesOwnerOption = {
  id: string;
  email: string;
  full_name: string | null;
  source: NewSalesOwnerSource;
  team: Team | null;
  searchValue: string;
  subtitle: string;
};

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

function kamTeamSubtitle(team: Team): string {
  switch (team) {
    case "ce":
      return "Core Team";
    case "staffing":
      return "Staffing";
    case "experts":
      return "Experts";
    default: {
      const _exhaustive: never = team;
      return _exhaustive;
    }
  }
}

/**
 * New Sales Owner dropdown: KAMs of other teams, plus users with the NSO role.
 * Dedupes by email (KAM entries win if the same person appears twice).
 */
export function buildNewSalesOwnerOptions(args: {
  kams: NewSalesOwnerKam[];
  nsos: NewSalesOwnerNso[];
  mandateTeam: Team | null;
}): NewSalesOwnerOption[] {
  const seen = new Set<string>();
  const options: NewSalesOwnerOption[] = [];

  if (args.mandateTeam) {
    for (const kam of args.kams) {
      const email = kam.email?.trim();
      if (!email) continue;
      if (!kam.team || kam.team === args.mandateTeam) continue;
      const key = normalizeEmail(email);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        id: kam.id,
        email,
        full_name: kam.full_name,
        source: "kam",
        team: kam.team,
        searchValue: `${(kam.full_name || "").trim()} ${email} kam ${kamTeamSubtitle(kam.team)}`,
        subtitle: `KAM · ${kamTeamSubtitle(kam.team)}`,
      });
    }
  }

  for (const nso of args.nsos) {
    const email = nso.email?.trim();
    if (!email) continue;
    const key = normalizeEmail(email);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      id: nso.id,
      email,
      full_name: nso.full_name,
      source: "nso",
      team: null,
      searchValue: `${(nso.full_name || "").trim()} ${email} nso`,
      subtitle: "NSO",
    });
  }

  return options;
}

/** Resolve a stored email to a display label from all KAMs and NSO-role users. */
export function formatNewSalesOwnerLabelFromPeople(
  email: string,
  kams: NewSalesOwnerKam[],
  nsos: NewSalesOwnerNso[],
): string {
  const key = normalizeEmail(email);
  if (!key) return email;
  const kam = kams.find((person) => normalizeEmail(person.email) === key);
  if (kam) {
    const name = kam.full_name?.trim() || kam.email;
    return `${name} (${kam.email})`;
  }
  const nso = nsos.find((person) => normalizeEmail(person.email) === key);
  if (nso) {
    const name = nso.full_name?.trim() || nso.email;
    return `${name} (${nso.email})`;
  }
  return email;
}

/** True when the email belongs to a KAM on the mandate's own team (not selectable). */
export function isOwnTeamKamEmail(
  email: string,
  kams: NewSalesOwnerKam[],
  mandateTeam: Team | null,
): boolean {
  if (!email.trim() || !mandateTeam) return false;
  const key = normalizeEmail(email);
  return kams.some(
    (kam) => kam.team === mandateTeam && normalizeEmail(kam.email) === key,
  );
}
