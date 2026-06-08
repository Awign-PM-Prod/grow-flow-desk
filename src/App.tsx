import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CrossSellDashboard from "./pages/CrossSellDashboard";
import Accounts from "./pages/Accounts";
import Contacts from "./pages/Contacts";
import Mandates from "./pages/Mandates";
import Pipeline from "./pages/Pipeline";
import { TargetsLayout } from "./pages/Targets";
import { MonthlyTargetsTab } from "./pages/targets/MonthlyTargetsTab";
import { OverallTargetsTab } from "./pages/targets/OverallTargetsTab";
import AdminUsers from "./pages/AdminUsers";
import AdminNSOs from "./pages/AdminNSOs";
import AdminNps from "./pages/AdminNps";
import AdminNpsFormConfig from "./pages/AdminNpsFormConfig";
import AdminKamTeamMapping from "./pages/AdminKamTeamMapping";
import NpsSurvey from "./pages/NpsSurvey";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/hooks/useAuth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/nps/:token" element={<NpsSurvey />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cross-sell-dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CrossSellDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Accounts />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Contacts />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mandates"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Mandates />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pipeline"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Pipeline />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/targets"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <TargetsLayout />
                </AppLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="mandate" replace />} />
            <Route
              path="mandate"
              element={<MonthlyTargetsTab mode="existing" />}
            />
            <Route
              path="pipeline"
              element={<MonthlyTargetsTab mode="new_cross_sell" />}
            />
            <Route path="top-level-target" element={<OverallTargetsTab />} />
            <Route path="overall" element={<Navigate to="../top-level-target" replace />} />
          </Route>
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AdminUsers />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/nso"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AdminNSOs />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/kam-team-mapping"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AdminKamTeamMapping />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/nps"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AdminNps />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/nps/configure"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AdminNpsFormConfig />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
