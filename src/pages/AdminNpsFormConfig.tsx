import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { NpsFormBuilder } from "@/components/nps/NpsFormBuilder";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function AdminNpsFormConfig() {
  const navigate = useNavigate();
  const { canManageUsers, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!canManageUsers) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, canManageUsers, navigate]);

  if (authLoading || !canManageUsers) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-2"
            onClick={() => navigate("/admin/nps")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to NPS Surveys
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">NPS Form Configuration</h1>
            <p className="text-muted-foreground">
              Configure survey title, instructions, questions, and input types. Changes apply to new submissions.
            </p>
          </div>
        </div>
      </div>

      <NpsFormBuilder />
    </div>
  );
}
