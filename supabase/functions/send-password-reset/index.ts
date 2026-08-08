import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  EMAIL_FROM,
  emailButton,
  emailInfoBox,
  emailParagraph,
  emailSignature,
  wrapBrandedEmail,
} from "./email-theme.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  full_name?: string;
  site_url?: string;
  /**
   * Set by the login page's "Forgot password" form. Such requests are
   * unauthenticated, so the response is always generic (no account enumeration).
   */
  self_service?: boolean;
}

type AppRole =
  | "kam"
  | "manager"
  | "leadership"
  | "superadmin"
  | "team_admin"
  | "nso";

interface TargetProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  team: string | null;
}

interface AdminCaller {
  userId: string;
  role: AppRole;
  team: string | null;
  isGlobalAdmin: boolean;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/**
 * Resolve the caller as an admin. Returns null when the request carries no real
 * user JWT (the Supabase SDK sends the public anon key when signed out), which
 * is the normal case for the self-service flow.
 */
async function resolveAdminCaller(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<AdminCaller | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, team")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as AppRole | undefined;
  if (!role || (role !== "superadmin" && role !== "team_admin")) return null;

  return {
    userId: user.id,
    role,
    team: (profile?.team as string | null) ?? null,
    isGlobalAdmin: role === "superadmin",
  };
}

/** Team admins may only reset passwords for non-superadmins on their own team. */
function adminCannotManageTarget(
  caller: AdminCaller,
  target: TargetProfile,
): string | null {
  if (caller.isGlobalAdmin) return null;
  if (target.role === "superadmin") {
    return "Team admins cannot reset super admin passwords";
  }
  if (!caller.team || target.team !== caller.team) {
    return "You can only manage users on your own team";
  }
  return null;
}

/**
 * Look the user up by email. Exact match first, then a case-insensitive retry
 * with LIKE wildcards escaped (`_` is common in email addresses).
 */
async function findProfileByEmail(
  supabaseAdmin: SupabaseClient,
  normalizedEmail: string,
): Promise<TargetProfile | null> {
  const columns = "id, email, full_name, role, team";

  const { data: exact } = await supabaseAdmin
    .from("profiles")
    .select(columns)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (exact) return exact as TargetProfile;

  const escaped = normalizedEmail.replace(/[\\%_]/g, "\\$&");
  const { data: caseInsensitive } = await supabaseAdmin
    .from("profiles")
    .select(columns)
    .ilike("email", escaped)
    .maybeSingle();

  return (caseInsensitive as TargetProfile | null) ?? null;
}

/** Where Supabase sends the user after it validates the recovery token. */
function buildRedirectUrl(siteUrl: string | undefined): string | undefined {
  const base = siteUrl?.trim().replace(/\/+$/, "");
  if (!base) return undefined;
  return `${base}/auth`;
}

async function sendResetEmail(params: {
  email: string;
  fullName: string;
  actionLink: string;
  siteUrl?: string;
  selfService: boolean;
}): Promise<void> {
  const { email, fullName, actionLink, siteUrl, selfService } = params;

  const introHtml = selfService
    ? emailParagraph(
        "We received a request to reset the password for your Awign CRM account.",
      )
    : emailParagraph(
        "Your administrator has sent you a password reset link for your Awign CRM account.",
      );

  const securityNoticeHtml = selfService
    ? `<strong>Security notice</strong><br><br>
      This link will expire in 24 hours for security reasons.<br>
      If you didn't request this reset, you can safely ignore this email — your password stays unchanged.`
    : `<strong>Security notice</strong><br><br>
      This link will expire in 24 hours for security reasons.<br>
      If you didn't request this reset, please contact your administrator.`;

  const resetContentHtml = [
    emailParagraph(`Hi ${fullName || "there"},`),
    introHtml,
    emailParagraph("Click the button below to set up a new password:"),
    emailButton(actionLink, "Reset Your Password"),
    emailInfoBox(securityNoticeHtml),
    emailSignature(["Team Awign CRM"]),
  ].join("");

  const emailResponse = await resend.emails.send({
    from: EMAIL_FROM,
    to: [email],
    subject: "Password Reset — Awign CRM",
    html: wrapBrandedEmail({
      title: "Password Reset",
      subtitle: "Set a new password for your account",
      preheader: "Reset your Awign CRM password using the secure link below.",
      contentHtml: resetContentHtml,
      siteUrl,
    }),
  });

  if ((emailResponse as { error?: unknown }).error) {
    console.error("Resend rejected the email:", (emailResponse as { error?: unknown }).error);
    throw new Error("Failed to send the password reset email");
  }

  console.log("Password reset email sent successfully to:", email);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!Deno.env.get("RESEND_API_KEY")) {
      throw new Error("Email sending is not configured (missing RESEND_API_KEY)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      email,
      full_name,
      site_url,
      self_service,
    }: PasswordResetRequest = await req.json();

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "A valid email is required" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const caller = self_service
      ? null
      : await resolveAdminCaller(req, supabaseAdmin);
    // Anything without an admin caller is treated as a self-service request and
    // gets the same generic response whether or not the account exists.
    const isSelfService = self_service === true || caller === null;

    const targetProfile = await findProfileByEmail(supabaseAdmin, normalizedEmail);

    if (!isSelfService && caller) {
      if (!targetProfile) {
        return jsonResponse({ error: "No user found with that email" }, 404);
      }
      const denialReason = adminCannotManageTarget(caller, targetProfile);
      if (denialReason) {
        return jsonResponse({ error: denialReason }, 403);
      }
    }

    const genericSelfServiceResponse = {
      success: true,
      message:
        "If an account exists for that email, a password reset link has been sent.",
    };

    if (isSelfService && !targetProfile) {
      console.log("Self-service reset requested for unknown email:", normalizedEmail);
      return jsonResponse(genericSelfServiceResponse, 200);
    }

    const redirectTo = buildRedirectUrl(site_url);
    const { data: resetData, error: resetError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: targetProfile?.email ?? normalizedEmail,
        options: redirectTo ? { redirectTo } : undefined,
      });

    if (resetError || !resetData?.properties?.action_link) {
      console.error("Error generating reset link:", resetError);
      if (isSelfService) {
        // Do not leak whether the address maps to a real auth user.
        return jsonResponse(genericSelfServiceResponse, 200);
      }
      throw new Error("Failed to generate password reset link");
    }

    await sendResetEmail({
      email: targetProfile?.email ?? normalizedEmail,
      fullName: full_name || targetProfile?.full_name || "",
      actionLink: resetData.properties.action_link,
      siteUrl: site_url,
      selfService: isSelfService,
    });

    return jsonResponse(
      isSelfService
        ? genericSelfServiceResponse
        : { success: true, message: "Password reset link sent successfully" },
      200,
    );
  } catch (error: unknown) {
    console.error("Error in send-password-reset function:", error);
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while sending the password reset link",
      },
      400,
    );
  }
};

serve(handler);
