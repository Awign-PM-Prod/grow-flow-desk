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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isInitializedRef = useRef(false);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name")
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
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setUserRoles([]);
      setFullName(null);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") {
          if (!isInitializedRef.current) {
            setSession(session);
            setUser(session?.user ?? null);
            isInitializedRef.current = true;

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

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
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
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Fallback to local sign-out so client session is always cleared.
        const { error: localError } = await supabase.auth.signOut({ scope: "local" });
        if (localError) {
          console.error("Sign out error:", localError);
        }
      }
    } catch (error: unknown) {
      // Network/API failure should not block local logout.
      const { error: localError } = await supabase.auth.signOut({ scope: "local" });
      if (localError) {
        console.error("Sign out error:", localError);
      } else {
        console.error("Sign out fallback used after error:", error);
      }
    } finally {
      setSession(null);
      setUser(null);
      setUserRoles([]);
      setFullName(null);
      setLoading(false);
      navigate("/auth", { replace: true });
    }
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
  }, [user, session, userRoles, fullName, loading, signOut, hasRole]);

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
