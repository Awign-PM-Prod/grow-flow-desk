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
import type { UserRole } from "@/hooks/useAuth";

function roleLabel(role: UserRole | undefined): string {
  switch (role) {
    case "kam":
      return "KAM";
    case "manager":
      return "Manager";
    case "leadership":
      return "Leadership";
    case "superadmin":
      return "Super Admin";
    case "nso":
      return "NSO";
    default:
      return "—";
  }
}

const APP_ROLES: UserRole[] = ["kam", "manager", "leadership", "superadmin", "nso"];

function coerceAppRole(value: unknown): UserRole | undefined {
  if (typeof value !== "string") return undefined;
  const r = value.toLowerCase().trim();
  return APP_ROLES.includes(r as UserRole) ? (r as UserRole) : undefined;
}

/** Readable placeholder when profiles.full_name is empty */
function displayNameFromEmail(email: string | undefined): string {
  if (!email) return "—";
  const local = email.split("@")[0] ?? "";
  const base = (local.split("+")[0] ?? local).trim();
  const parts = base.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function AppSidebar() {
  const {
    isKAM,
    isManager,
    isLeadership,
    isSuperAdmin,
    signOut,
    user,
    userRoles,
    fullName,
  } = useAuth();

  const nameLine =
    fullName?.trim() ||
    (typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") ||
    "—";

  const metadataRole =
    coerceAppRole(user?.app_metadata?.role) ??
    coerceAppRole((user?.user_metadata as { role?: string } | undefined)?.role);
  const resolvedRole = userRoles[0] ?? metadataRole;

  const [guideDialogOpen, setGuideDialogOpen] = useState(false);

  const mainMenuItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      roles: ["kam", "manager", "leadership", "superadmin", "nso"],
    },
    {
      title: "Cross Sell Pipeline Dashboard",
      url: "/cross-sell-dashboard",
      icon: BarChart3,
      roles: ["kam", "manager", "leadership", "superadmin", "nso"],
    },
    {
      title: "Accounts",
      url: "/accounts",
      icon: Building2,
      roles: ["kam", "manager", "leadership", "superadmin", "nso"],
    },
    {
      title: "Contacts",
      url: "/contacts",
      icon: Users,
      roles: ["kam", "manager", "leadership", "superadmin", "nso"],
    },
    {
      title: "Mandates",
      url: "/mandates",
      icon: FileText,
      roles: ["kam", "manager", "leadership", "superadmin", "nso"],
    },
    {
      title: "Cross-sell Pipeline",
      url: "/pipeline",
      icon: TrendingUp,
      roles: ["kam", "manager", "leadership", "superadmin", "nso"],
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
    if (resolvedRole === "nso" && itemRoles.includes("nso")) return true;
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
          {/* Sidebar tokens only — avoids low-contrast card on dark sidebar; labels always visible */}
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent p-3">
            <div className="space-y-3">
              <div className="min-h-[2.75rem]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/65">
                  Full name
                </p>
                <p className="mt-1 break-words text-sm font-semibold leading-snug text-sidebar-foreground">
                  {nameLine}
                </p>
              </div>
              <div className="min-h-[2.75rem]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/65">
                  Role
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-sidebar-foreground">
                  {roleLabel(resolvedRole)}
                </p>
              </div>
              <div className="min-h-[2.75rem]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/65">
                  Email
                </p>
                <p className="mt-1 break-all text-sm font-semibold leading-snug text-sidebar-foreground">
                  {user?.email ?? "—"}
                </p>
              </div>
            </div>
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
