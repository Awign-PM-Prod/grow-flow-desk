import { useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type UserRole = "kam" | "manager" | "leadership" | "superadmin";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isInitializedRef = useRef(false);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data && data.role) {
        // Since role is now a single value instead of an array, we convert it to an array for compatibility
        setUserRoles([data.role as UserRole]);
      } else {
        setUserRoles([]);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setUserRoles([]);
    }
  };

  useEffect(() => {
    // Set up auth state listener first - INITIAL_SESSION will fire immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Handle INITIAL_SESSION event - this fires when listener is set up
        // Use this for initial state instead of getSession() to avoid duplicate token refresh calls
        if (event === 'INITIAL_SESSION') {
          if (!isInitializedRef.current) {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            isInitializedRef.current = true;
            
            if (session?.user) {
              fetchUserRoles(session.user.id);
            }
          }
          return;
        }

        // Ignore TOKEN_REFRESHED events to prevent excessive token refresh requests
        // The session is already valid, we don't need to update state or fetch roles again
        // This prevents rate limiting (429 errors) from frequent token refresh attempts
        if (event === 'TOKEN_REFRESHED') {
          // Silently update session reference without triggering state updates
          // This prevents unnecessary re-renders and role fetches
          setSession(session);
          return;
        }

        // Only process other auth state changes after initial session check is complete
        // This prevents race conditions where the listener fires and clears user before initialization
        if (!isInitializedRef.current) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setUserRoles([]);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      // If we get a 403 error, it's often due to session mismatch - we can ignore it
      // and proceed to clear local session data
      if (error) {
        // 403 errors are common when session is already invalidated - we can safely ignore
        if (error.status !== 403) {
          console.error("Sign out error:", error);
        }
      }
    } catch (error: any) {
      // Handle 403 or other errors gracefully
      // 403 errors during signOut are often harmless (session already invalidated)
      if (error?.status !== 403) {
        console.error("Sign out error:", error);
      }
    } finally {
      // Always navigate to auth page, even if signOut API call fails
      // Supabase client will clear local storage automatically
      navigate("/auth");
    }
  };

  const hasRole = (role: UserRole) => userRoles.includes(role);
  
  const isSuperAdmin = hasRole("superadmin");
  const isLeadership = hasRole("leadership") || isSuperAdmin;
  const isManager = hasRole("manager") || isLeadership;
  const isKAM = hasRole("kam") || isManager;

  return {
    user,
    session,
    userRoles,
    loading,
    signOut,
    hasRole,
    isSuperAdmin,
    isLeadership,
    isManager,
    isKAM,
  };
}
