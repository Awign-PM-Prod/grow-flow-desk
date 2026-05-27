import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { formatFYLabel, getCurrentFYKey, listFYKeysDescending } from "./financialYearUtils";

export type TargetsOutletContext = {
  filterFinancialYear: string;
  setFilterFinancialYear: (v: string) => void;
  selectedTeam: "all" | "ce" | "staffing" | "experts";
};

const tabClass =
  "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors";
const tabActiveClass = "bg-primary text-primary-foreground shadow";
const tabInactiveClass =
  "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground";

export function TargetsLayout() {
  const { hasRole, loading, userRoles, user, canSelectAllTeams, team: userTeam } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = hasRole("superadmin");

  const [filterFinancialYear, setFilterFinancialYear] = useState<string>(() =>
    getCurrentFYKey()
  );
  const [selectedTeam, setSelectedTeam] = useState<"all" | "ce" | "staffing" | "experts">(
    "all"
  );

  const fyOptions = useMemo(() => listFYKeysDescending(12), []);

  useEffect(() => {
    if (canSelectAllTeams) return;
    if (userTeam) {
      setSelectedTeam(userTeam);
    }
  }, [canSelectAllTeams, userTeam]);

  useEffect(() => {
    if (!loading && userRoles.length > 0 && user !== undefined) {
      const hasAccess =
        hasRole("manager") ||
        hasRole("leadership") ||
        hasRole("superadmin") ||
        hasRole("team_admin") ||
        hasRole("kam");
      if (!hasAccess) {
        navigate("/dashboard");
      }
    }
  }, [loading, userRoles.length, user, navigate, hasRole]);

  if (loading || userRoles.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const hasAccess =
    hasRole("manager") ||
    hasRole("leadership") ||
    hasRole("superadmin") ||
    hasRole("team_admin") ||
    hasRole("kam");

  if (!hasAccess) {
    return null;
  }

  if (
    location.pathname === "/targets" ||
    location.pathname === "/targets/"
  ) {
    return <Navigate to="/targets/mandate" replace />;
  }

  if (location.pathname.includes("/targets/top-level-target") && !isSuperAdmin) {
    return <Navigate to="/targets/mandate" replace />;
  }

  const outletContext: TargetsOutletContext = {
    filterFinancialYear,
    setFilterFinancialYear,
    selectedTeam,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Targets</h1>
          <p className="text-muted-foreground">
            Manage mandate-level, pipeline, and overall targets by financial
            year.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-2">
            <NavLink
              to="/targets/mandate"
              className={cn(tabClass, tabInactiveClass)}
              activeClassName={cn(tabClass, tabActiveClass)}
            >
              Mandate Level Targets
            </NavLink>
            <NavLink
              to="/targets/pipeline"
              className={cn(tabClass, tabInactiveClass)}
              activeClassName={cn(tabClass, tabActiveClass)}
            >
              Pipeline Deals Targets
            </NavLink>
            {isSuperAdmin ? (
              <NavLink
                to="/targets/top-level-target"
                className={cn(tabClass, tabInactiveClass)}
                activeClassName={cn(tabClass, tabActiveClass)}
              >
                Top Level Target
              </NavLink>
            ) : null}
          </nav>
          <div className="flex items-center gap-2">
            {canSelectAllTeams ? (
              <Select value={selectedTeam} onValueChange={(v) => setSelectedTeam(v as "all" | "ce" | "staffing" | "experts")}>
                <SelectTrigger className="w-[160px] sm:w-[180px]">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  <SelectItem value="ce">CE</SelectItem>
                  <SelectItem value="staffing">Staffing</SelectItem>
                  <SelectItem value="experts">Experts</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Select
              value={filterFinancialYear}
              onValueChange={setFilterFinancialYear}
            >
              <SelectTrigger className="w-[200px] sm:w-[220px]">
                <SelectValue placeholder="Financial year" />
              </SelectTrigger>
              <SelectContent>
                {fyOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    {formatFYLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <Outlet context={outletContext} />
    </div>
  );
}
