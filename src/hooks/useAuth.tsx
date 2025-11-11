import { useEffect, useState } from "react";
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

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      
      if (data) {
        setUserRoles(data.map(r => r.role as UserRole));
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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
