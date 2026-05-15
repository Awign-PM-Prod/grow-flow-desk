import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type UserRole = "kam" | "manager" | "leadership" | "superadmin" | "nso";
export type Team = "ce" | "staffing" | "experts";

/** Map profiles.role (or JWT metadata) to a canonical app role. */
function normalizeProfileRole(raw: unknown): UserRole | null {
  if (raw === null || raw === undefined) return null;
  const compact = String(raw)
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "");
  if (compact === "kam") return "kam";
  if (compact === "manager") return "manager";
  if (compact === "leadership") return "leadership";
  if (compact === "superadmin") return "superadmin";
  if (compact === "nso") return "nso";
  return null;
}

function roleFromSessionUser(user: User | null | undefined): UserRole | null {
  if (!user) return null;
  const app = user.app_metadata?.role;
  const um = (user.user_metadata as { role?: unknown } | undefined)?.role;
  if (typeof app === "string") return normalizeProfileRole(app);
  return normalizeProfileRole(um);
}

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  userRoles: UserRole[];
  fullName: string | null;
  team: Team | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  isSuperAdmin: boolean;
  isLeadership: boolean;
  isManager: boolean;
  isKAM: boolean;
  /** True for leadership or NSO: portal data is read-only at the UI. */
  isReadOnlyLeadership: boolean;
  isNSO: boolean;
  canMutatePortal: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Remove persisted Supabase session keys when signOut does not clear storage in time. */
function clearSupabaseAuthStorage() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("sb-") && key.includes("auth")) {
      localStorage.removeItem(key);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [fullName, setFullName] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isInitializedRef = useRef(false);
  /** Last user id we applied to state; avoids full-app "loading" on token refresh / duplicate auth events when tab regains focus. */
  const lastUserIdRef = useRef<string | null>(null);
  const isSigningOutRef = useRef(false);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name, team")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      const trimmedName = data?.full_name?.trim() || null;
      setFullName(trimmedName);

      const roleNorm = normalizeProfileRole(data?.role);
      if (roleNorm) {
        setUserRoles([roleNorm]);
      } else {
        setUserRoles([]);
      }

      const rawTeam = data?.team ?? null;
      if (rawTeam === "ce" || rawTeam === "staffing" || rawTeam === "experts") {
        setTeam(rawTeam);
      } else {
        setTeam(null);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setUserRoles([]);
      setFullName(null);
      setTeam(null);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isSigningOutRef.current) {
          if (event === "SIGNED_OUT" || !session) {
            isSigningOutRef.current = false;
            lastUserIdRef.current = null;
            setSession(null);
            setUser(null);
            setUserRoles([]);
            setFullName(null);
            setTeam(null);
            setLoading(false);
          }
          return;
        }

        if (event === "SIGNED_OUT") {
          lastUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setUserRoles([]);
          setFullName(null);
          setTeam(null);
          setLoading(false);
          return;
        }

        if (event === "INITIAL_SESSION") {
          if (!isInitializedRef.current) {
            setSession(session);
            setUser(session?.user ?? null);
            isInitializedRef.current = true;
            lastUserIdRef.current = session?.user?.id ?? null;

            if (session?.user) {
              void fetchUserRoles(session.user.id).finally(() => {
                setLoading(false);
              });
            } else {
              setUserRoles([]);
              setFullName(null);
              setLoading(false);
            }
          }
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          setSession(session);
          return;
        }

        if (!isInitializedRef.current) {
          return;
        }

        const prevUserId = lastUserIdRef.current;
        const nextUserId = session?.user?.id ?? null;
        const isSameUser =
          prevUserId !== null &&
          nextUserId !== null &&
          nextUserId === prevUserId;

        setSession(session);
        setUser(session?.user ?? null);
        lastUserIdRef.current = nextUserId;

        if (session?.user) {
          if (isSameUser) {
            void fetchUserRoles(session.user.id);
            return;
          }
          setLoading(true);
          setTimeout(() => {
            void fetchUserRoles(session.user.id).finally(() => {
              setLoading(false);
            });
          }, 0);
        } else {
          setUserRoles([]);
          setFullName(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserRoles]);

  // Refetch profile whenever auth user is set (login, refresh, first paint with session).
  // Supplements INITIAL_SESSION so role/full_name are not stuck empty on some navigations.
  useEffect(() => {
    if (!user?.id) return;
    void fetchUserRoles(user.id);
  }, [user?.id, fetchUserRoles]);

  const signOut = useCallback(async () => {
    isSigningOutRef.current = true;
    setLoading(true);
    try {
      // Clear local session first so storage cannot resurrect the user on /auth.
      const { error: localError } = await supabase.auth.signOut({ scope: "local" });
      if (localError) {
        console.error("Local sign out error:", localError);
        clearSupabaseAuthStorage();
      }
      // Revoke refresh token on server when possible (non-blocking).
      void supabase.auth.signOut({ scope: "global" }).catch(() => {});
    } catch (error: unknown) {
      console.error("Sign out error:", error);
      clearSupabaseAuthStorage();
    }

    const { data: { session: lingering } } = await supabase.auth.getSession();
    if (lingering) {
      clearSupabaseAuthStorage();
    }

    lastUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setUserRoles([]);
    setFullName(null);
    setTeam(null);
    setLoading(false);
    isSigningOutRef.current = false;
    navigate("/auth", { replace: true });
  }, [navigate]);

  const hasRole = useCallback(
    (role: UserRole) =>
      userRoles.some((r) => String(r).toLowerCase() === role),
    [userRoles]
  );

  const value = useMemo((): AuthContextValue => {
    const isSuperAdmin = hasRole("superadmin");
    const sessionRole = roleFromSessionUser(user);
    const readOnlyFromSession =
      userRoles.length === 0 &&
      (sessionRole === "leadership" || sessionRole === "nso");
    const isNSO = hasRole("nso");
    const isReadOnlyLeadership =
      !isSuperAdmin &&
      (hasRole("leadership") || isNSO || readOnlyFromSession);
    return {
      user,
      session,
      userRoles,
      fullName,
      team,
      loading,
      signOut,
      hasRole,
      isSuperAdmin,
      isLeadership: hasRole("leadership") || isSuperAdmin,
      isManager: hasRole("manager") || hasRole("leadership") || isSuperAdmin,
      isKAM:
        hasRole("kam") ||
        hasRole("manager") ||
        hasRole("leadership") ||
        isSuperAdmin,
      isReadOnlyLeadership,
      isNSO,
      canMutatePortal: !loading && !isReadOnlyLeadership,
    };
  }, [user, session, userRoles, fullName, team, loading, signOut, hasRole]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
