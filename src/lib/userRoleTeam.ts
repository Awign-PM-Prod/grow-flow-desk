import type { UserRole } from "@/hooks/useAuth";

/** Super Admin, Leadership, and NSO are org-wide and are not assigned a team. */
export function roleRequiresTeam(
  role: UserRole | string | null | undefined,
): boolean {
  switch (role) {
    case "superadmin":
    case "nso":
    case "leadership":
    case "":
    case null:
    case undefined:
      return false;
    case "kam":
    case "manager":
    case "team_admin":
      return true;
    default:
      return true;
  }
}
