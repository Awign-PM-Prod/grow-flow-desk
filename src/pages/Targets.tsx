import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Targets() {
  const { hasRole, loading, userRoles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && userRoles.length > 0) {
      // Only allow manager, leadership, and superadmin roles
      // KAM users should not have access
      const hasAccess = hasRole("manager") || hasRole("leadership") || hasRole("superadmin");
      
      if (!hasAccess) {
        navigate("/dashboard");
      }
    }
  }, [hasRole, loading, userRoles, navigate]);

  // Show loading state while checking permissions
  if (loading || userRoles.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user has access (manager, leadership, or superadmin)
  const hasAccess = hasRole("manager") || hasRole("leadership") || hasRole("superadmin");

  if (!hasAccess) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Targets</h1>
          <p className="text-muted-foreground">
            Manage your sales targets and goals.
          </p>
        </div>
      </div>

      {/* Demo Content */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Targets Page</h2>
            <p className="text-muted-foreground mb-6">
              This is a demo page for the Targets feature. Content will be added here.
            </p>
            <Button>Get Started</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

