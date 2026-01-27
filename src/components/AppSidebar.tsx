import { Building2, Users, FileText, TrendingUp, LayoutDashboard, UserCog, Target, BarChart3, BookOpen } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PDFGuideDialog } from "@/components/PDFGuideDialog";

export function AppSidebar() {
  const { isKAM, isManager, isLeadership, isSuperAdmin, signOut, user } = useAuth();
  const [guideDialogOpen, setGuideDialogOpen] = useState(false);

  const mainMenuItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      roles: ["kam", "manager", "leadership", "superadmin"],
    },
    {
      title: "Cross Sell Pipeline Dashboard",
      url: "/cross-sell-dashboard",
      icon: BarChart3,
      roles: ["kam", "manager", "leadership", "superadmin"],
    },
    {
      title: "Accounts",
      url: "/accounts",
      icon: Building2,
      roles: ["kam", "manager", "leadership", "superadmin"],
    },
    {
      title: "Contacts",
      url: "/contacts",
      icon: Users,
      roles: ["kam", "manager", "leadership", "superadmin"],
    },
    {
      title: "Mandates",
      url: "/mandates",
      icon: FileText,
      roles: ["kam", "manager", "leadership", "superadmin"],
    },
    {
      title: "Cross-sell Pipeline",
      url: "/pipeline",
      icon: TrendingUp,
      roles: ["kam", "manager", "leadership", "superadmin"],
    },
    {
      title: "Targets",
      url: "/targets",
      icon: Target,
      roles: ["kam", "leadership", "superadmin"],
    },
  ];

  const adminMenuItems = [
    {
      title: "User Management",
      url: "/admin/users",
      icon: UserCog,
      roles: ["superadmin"],
    },
  ];

  const canAccessItem = (itemRoles: string[]) => {
    if (isSuperAdmin) return true;
    if (isLeadership && itemRoles.includes("leadership")) return true;
    if (isManager && itemRoles.includes("manager")) return true;
    if (isKAM && itemRoles.includes("kam")) return true;
    return false;
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">Mandates Portal</h1>
            <p className="text-xs text-muted-foreground">Sales Management</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Help</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setGuideDialogOpen(true)}>
                  <BookOpen className="h-4 w-4" />
                  <span>Guide</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems
                .filter((item) => canAccessItem(item.roles))
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="space-y-2">
          <div className="text-sm text-sidebar-foreground">
            <p className="font-medium">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="w-full bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
          >
            Sign Out
          </Button>
        </div>
      </SidebarFooter>

      {/* PDF Guide Dialog */}
      <PDFGuideDialog
        open={guideDialogOpen}
        onOpenChange={setGuideDialogOpen}
        pdfPath="/Guide.pdf"
        pages={[]}
      />
    </Sidebar>
  );
}
