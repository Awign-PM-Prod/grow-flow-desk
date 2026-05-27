import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type AppRole = "kam" | "manager" | "leadership" | "superadmin" | "team_admin" | "nso";
type Team = "ce" | "staffing" | "experts";

interface AdminCaller {
  userId: string;
  role: AppRole;
  team: Team | null;
  isGlobalAdmin: boolean;
}

async function requireAdmin(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<AdminCaller | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("Missing authorization header", 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const { data: userProfile, error: roleError } = await supabaseAdmin
    .from("profiles")
    .select("role, team")
    .eq("id", user.id)
    .single();

  const role = userProfile?.role as AppRole | undefined;
  if (roleError || !role || (role !== "superadmin" && role !== "team_admin")) {
    return errorResponse("Only admins can perform this action", 403);
  }

  return {
    userId: user.id,
    role,
    team: (userProfile?.team as Team | null) ?? null,
    isGlobalAdmin: role === "superadmin",
  };
}

function assertTeamAdminCanManageTarget(
  caller: AdminCaller,
  target: { role: string | null; team: string | null },
): string | null {
  if (caller.isGlobalAdmin) return null;
  if (target.role === "superadmin") {
    return "Team admins cannot modify super admin users";
  }
  if (!caller.team || target.team !== caller.team) {
    return "You can only manage users on your own team";
  }
  return null;
}

interface UpdateUserRequest {
  user_id: string;
  role: AppRole;
  team?: Team | null;
}

const VALID_ROLES: AppRole[] = ["kam", "manager", "leadership", "superadmin", "team_admin", "nso"];
const VALID_TEAMS: Team[] = ["ce", "staffing", "experts"];
const TEAM_ADMIN_ASSIGNABLE: AppRole[] = ["kam", "manager", "leadership", "team_admin", "nso"];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createServiceClient();
    const authResult = await requireAdmin(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;

    const { user_id, role, team }: UpdateUserRequest = await req.json();

    if (!user_id || !role) {
      return errorResponse("Missing required fields: user_id, role");
    }

    if (!VALID_ROLES.includes(role)) {
      return errorResponse("Invalid role");
    }

    if (!authResult.isGlobalAdmin) {
      if (!TEAM_ADMIN_ASSIGNABLE.includes(role)) {
        return errorResponse("Team admins cannot assign this role");
      }
      if (role === "superadmin") {
        return errorResponse("Team admins cannot assign super admin role");
      }
    }

    const resolvedTeam: Team | null = role === "superadmin"
      ? null
      : (authResult.isGlobalAdmin ? (team ?? null) : authResult.team);

    if (role !== "superadmin") {
      if (!resolvedTeam || !VALID_TEAMS.includes(resolvedTeam)) {
        return errorResponse("A valid team is required for this role");
      }
      if (!authResult.isGlobalAdmin && resolvedTeam !== authResult.team) {
        return errorResponse("Team admins can only assign users to their own team");
      }
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, team")
      .eq("id", user_id)
      .maybeSingle();

    if (fetchError) {
      return errorResponse(fetchError.message, 500);
    }

    if (!existing) {
      return errorResponse("User not found", 404);
    }

    const scopeError = assertTeamAdminCanManageTarget(authResult, existing);
    if (scopeError) {
      return errorResponse(scopeError, 403);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role, team: resolvedTeam })
      .eq("id", user_id)
      .select("id, email, full_name, role, team")
      .single();

    if (updateError) {
      return errorResponse(`Failed to update user: ${updateError.message}`, 500);
    }

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: {
        full_name: existing.full_name,
        role,
        team: resolvedTeam,
      },
    });

    if (metaError) {
      console.warn("Profile updated but auth metadata sync failed:", metaError.message);
    }

    return jsonResponse({
      success: true,
      message: "User updated successfully",
      user: updated,
    });
  } catch (error: unknown) {
    console.error("Error in update-user:", error);
    const message = error instanceof Error ? error.message : "Failed to update user";
    return errorResponse(message, 500);
  }
};

serve(handler);
