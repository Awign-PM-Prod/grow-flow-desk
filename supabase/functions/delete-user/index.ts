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
    return "Team admins cannot delete super admin users";
  }
  if (!caller.team || target.team !== caller.team) {
    return "You can only delete users on your own team";
  }
  return null;
}

interface DeleteUserRequest {
  action: "preview" | "delete";
  user_id: string;
  transfer_to_user_id?: string | null;
}

interface OwnershipCounts {
  mandates_as_kam: number;
  pipeline_deals_as_kam: number;
  monthly_targets_as_kam: number;
  mandates_created: number;
  pipeline_deals_created: number;
  accounts_created: number;
  contacts_created: number;
  monthly_targets_created: number;
  new_sales_officers_created: number;
  deal_status_history_changed: number;
  mandates_as_nso: number;
  monthly_targets_as_nso: number;
  new_sales_officer_by_email: number;
}

async function countEq(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    console.error(`Count failed for ${table}.${column}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function countEmailMatch(
  supabase: SupabaseClient,
  table: string,
  column: string,
  email: string,
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .ilike(column, normalized);

  if (error) {
    console.error(`Email count failed for ${table}.${column}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function getOwnershipCounts(
  supabase: SupabaseClient,
  userId: string,
  email: string,
): Promise<OwnershipCounts> {
  const normalizedEmail = email.trim().toLowerCase();

  const [
    mandates_as_kam,
    pipeline_deals_as_kam,
    monthly_targets_as_kam,
    mandates_created,
    pipeline_deals_created,
    accounts_created,
    contacts_created,
    monthly_targets_created,
    new_sales_officers_created,
    deal_status_history_changed,
    mandates_as_nso,
    monthly_targets_as_nso,
    new_sales_officer_by_email,
  ] = await Promise.all([
    countEq(supabase, "mandates", "kam_id", userId),
    countEq(supabase, "pipeline_deals", "kam_id", userId),
    countEq(supabase, "monthly_targets", "kam_id", userId),
    countEq(supabase, "mandates", "created_by", userId),
    countEq(supabase, "pipeline_deals", "created_by", userId),
    countEq(supabase, "accounts", "created_by", userId),
    countEq(supabase, "contacts", "created_by", userId),
    countEq(supabase, "monthly_targets", "created_by", userId),
    countEq(supabase, "new_sales_officers", "created_by", userId),
    countEq(supabase, "deal_status_history", "changed_by", userId),
    countEmailMatch(supabase, "mandates", "new_sales_owner", normalizedEmail),
    countEmailMatch(supabase, "monthly_targets", "nso_mail_id", normalizedEmail),
    countEmailMatch(supabase, "new_sales_officers", "mail_id", normalizedEmail),
  ]);

  return {
    mandates_as_kam,
    pipeline_deals_as_kam,
    monthly_targets_as_kam,
    mandates_created,
    pipeline_deals_created,
    accounts_created,
    contacts_created,
    monthly_targets_created,
    new_sales_officers_created,
    deal_status_history_changed,
    mandates_as_nso,
    monthly_targets_as_nso,
    new_sales_officer_by_email,
  };
}

async function transferOwnership(
  supabase: SupabaseClient,
  fromUserId: string,
  toUserId: string,
  fromEmail: string,
  toEmail: string,
  role: AppRole,
): Promise<void> {
  const kamTables = ["mandates", "pipeline_deals", "monthly_targets"] as const;
  for (const table of kamTables) {
    const { error } = await supabase
      .from(table)
      .update({ kam_id: toUserId })
      .eq("kam_id", fromUserId);
    if (error) throw new Error(`Failed to transfer ${table} KAM assignments: ${error.message}`);
  }

  const createdByTables = [
    "mandates",
    "pipeline_deals",
    "accounts",
    "contacts",
    "monthly_targets",
    "new_sales_officers",
  ] as const;

  for (const table of createdByTables) {
    const { error } = await supabase
      .from(table)
      .update({ created_by: toUserId })
      .eq("created_by", fromUserId);
    if (error) throw new Error(`Failed to transfer ${table} created_by: ${error.message}`);
  }

  const { error: historyError } = await supabase
    .from("deal_status_history")
    .update({ changed_by: toUserId })
    .eq("changed_by", fromUserId);
  if (historyError) {
    throw new Error(`Failed to transfer deal status history: ${historyError.message}`);
  }

  if (role === "nso") {
    const fromNorm = fromEmail.trim().toLowerCase();
    const toNorm = toEmail.trim().toLowerCase();

    const { data: nsoMandates, error: mandateFetchError } = await supabase
      .from("mandates")
      .select("id, new_sales_owner")
      .not("new_sales_owner", "is", null);

    if (mandateFetchError) {
      throw new Error(`Failed to load NSO mandates: ${mandateFetchError.message}`);
    }

    const mandateIds = (nsoMandates ?? [])
      .filter((m) => (m.new_sales_owner ?? "").trim().toLowerCase() === fromNorm)
      .map((m) => m.id);

    if (mandateIds.length > 0) {
      const { error } = await supabase
        .from("mandates")
        .update({ new_sales_owner: toNorm })
        .in("id", mandateIds);
      if (error) throw new Error(`Failed to transfer NSO mandate ownership: ${error.message}`);
    }

    const { data: nsoTargets, error: targetFetchError } = await supabase
      .from("monthly_targets")
      .select("id, nso_mail_id")
      .not("nso_mail_id", "is", null);

    if (targetFetchError) {
      throw new Error(`Failed to load NSO targets: ${targetFetchError.message}`);
    }

    const targetIds = (nsoTargets ?? [])
      .filter((t) => (t.nso_mail_id ?? "").trim().toLowerCase() === fromNorm)
      .map((t) => t.id);

    if (targetIds.length > 0) {
      const { error } = await supabase
        .from("monthly_targets")
        .update({ nso_mail_id: toNorm })
        .in("id", targetIds);
      if (error) throw new Error(`Failed to transfer NSO target ownership: ${error.message}`);
    }

    const { data: nsoRecords, error: nsoFetchError } = await supabase
      .from("new_sales_officers")
      .select("id, mail_id");

    if (nsoFetchError) {
      throw new Error(`Failed to load NSO records: ${nsoFetchError.message}`);
    }

    const nsoIds = (nsoRecords ?? [])
      .filter((r) => (r.mail_id ?? "").trim().toLowerCase() === fromNorm)
      .map((r) => r.id);

    if (nsoIds.length > 0) {
      const { error } = await supabase
        .from("new_sales_officers")
        .update({ mail_id: toNorm, created_by: toUserId })
        .in("id", nsoIds);
      if (error) throw new Error(`Failed to transfer NSO officer records: ${error.message}`);
    }
  }
}

async function clearOwnership(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  role: AppRole,
): Promise<void> {
  const kamTables = ["mandates", "pipeline_deals", "monthly_targets"] as const;
  for (const table of kamTables) {
    const { error } = await supabase
      .from(table)
      .update({ kam_id: null })
      .eq("kam_id", userId);
    if (error) throw new Error(`Failed to clear ${table} KAM assignments: ${error.message}`);
  }

  const createdByTables = [
    "mandates",
    "pipeline_deals",
    "accounts",
    "contacts",
    "monthly_targets",
    "new_sales_officers",
  ] as const;

  for (const table of createdByTables) {
    const { error } = await supabase
      .from(table)
      .update({ created_by: null })
      .eq("created_by", userId);
    if (error) throw new Error(`Failed to clear ${table} created_by: ${error.message}`);
  }

  const { error: historyError } = await supabase
    .from("deal_status_history")
    .update({ changed_by: null })
    .eq("changed_by", userId);
  if (historyError) {
    throw new Error(`Failed to clear deal status history: ${historyError.message}`);
  }

  if (role === "nso") {
    const normalized = email.trim().toLowerCase();

    const { data: nsoMandates, error: mandateFetchError } = await supabase
      .from("mandates")
      .select("id, new_sales_owner")
      .not("new_sales_owner", "is", null);

    if (mandateFetchError) {
      throw new Error(`Failed to load NSO mandates: ${mandateFetchError.message}`);
    }

    const mandateIds = (nsoMandates ?? [])
      .filter((m) => (m.new_sales_owner ?? "").trim().toLowerCase() === normalized)
      .map((m) => m.id);

    if (mandateIds.length > 0) {
      const { error } = await supabase
        .from("mandates")
        .update({ new_sales_owner: null })
        .in("id", mandateIds);
      if (error) throw new Error(`Failed to clear NSO mandate mapping: ${error.message}`);
    }

    const { data: nsoTargets, error: targetFetchError } = await supabase
      .from("monthly_targets")
      .select("id, nso_mail_id")
      .not("nso_mail_id", "is", null);

    if (targetFetchError) {
      throw new Error(`Failed to load NSO targets: ${targetFetchError.message}`);
    }

    const targetIds = (nsoTargets ?? [])
      .filter((t) => (t.nso_mail_id ?? "").trim().toLowerCase() === normalized)
      .map((t) => t.id);

    if (targetIds.length > 0) {
      const { error } = await supabase
        .from("monthly_targets")
        .update({ nso_mail_id: null })
        .in("id", targetIds);
      if (error) throw new Error(`Failed to clear NSO target mapping: ${error.message}`);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createServiceClient();
    const authResult = await requireAdmin(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;

    const { action, user_id, transfer_to_user_id }: DeleteUserRequest = await req.json();

    if (!user_id || !action) {
      return errorResponse("Missing required fields: action, user_id");
    }

    if (user_id === authResult.userId) {
      return errorResponse("You cannot delete your own account");
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, team")
      .eq("id", user_id)
      .maybeSingle();

    if (targetError) {
      return errorResponse(targetError.message, 500);
    }

    if (!targetUser) {
      return errorResponse("User not found", 404);
    }

    const scopeError = assertTeamAdminCanManageTarget(authResult, targetUser);
    if (scopeError) {
      return errorResponse(scopeError, 403);
    }

    const counts = await getOwnershipCounts(
      supabaseAdmin,
      user_id,
      targetUser.email,
    );

    if (action === "preview") {
      return jsonResponse({
        success: true,
        user: targetUser,
        counts,
        total_linked:
          Object.values(counts).reduce((sum, n) => sum + n, 0),
      });
    }

    if (action !== "delete") {
      return errorResponse("Invalid action");
    }

    if (transfer_to_user_id) {
      if (transfer_to_user_id === user_id) {
        return errorResponse("Cannot transfer ownership to the same user");
      }

      const { data: replacement, error: replacementError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, role, team")
        .eq("id", transfer_to_user_id)
        .maybeSingle();

      if (replacementError) {
        return errorResponse(replacementError.message, 500);
      }

      if (!replacement) {
        return errorResponse("Replacement user not found", 404);
      }

      if (replacement.role !== targetUser.role) {
        return errorResponse("Replacement user must have the same role");
      }

      if (replacement.team !== targetUser.team) {
        return errorResponse("Replacement user must be on the same team");
      }

      await transferOwnership(
        supabaseAdmin,
        user_id,
        transfer_to_user_id,
        targetUser.email,
        replacement.email,
        targetUser.role as AppRole,
      );
    } else {
      await clearOwnership(
        supabaseAdmin,
        user_id,
        targetUser.email,
        targetUser.role as AppRole,
      );
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) {
      return errorResponse(`Failed to delete user: ${deleteError.message}`, 500);
    }

    return jsonResponse({
      success: true,
      message: transfer_to_user_id
        ? "User deleted and ownership transferred successfully"
        : "User deleted and mappings cleared successfully",
      transferred_to: transfer_to_user_id ?? null,
    });
  } catch (error: unknown) {
    console.error("Error in delete-user:", error);
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return errorResponse(message, 500);
  }
};

serve(handler);
