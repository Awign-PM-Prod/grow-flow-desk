import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
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

interface InviteUserRequest {
  email: string;
  full_name: string;
  role: "kam" | "manager" | "leadership" | "superadmin" | "team_admin" | "nso";
  team?: "ce" | "staffing" | "experts" | null;
  password: string;
  site_url?: string;
  skip_welcome_email?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is a superadmin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: userProfile, error: roleError } = await supabaseAdmin
      .from("profiles")
      .select("role, team")
      .eq("id", user.id)
      .single();

    const callerRole = userProfile?.role;
    const isGlobalAdmin = callerRole === "superadmin";
    const isTeamAdmin = callerRole === "team_admin";

    if (roleError || (!isGlobalAdmin && !isTeamAdmin)) {
      throw new Error("Only admins can invite users");
    }

    const {
      email,
      full_name,
      role,
      team,
      password,
      site_url,
      skip_welcome_email = false,
    }: InviteUserRequest = await req.json();

    console.log("Inviting user:", { email, full_name, role, team });

    if (!email || !full_name || !role || !password) {
      throw new Error("Missing required fields");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const validRoles = ["kam", "manager", "leadership", "superadmin", "team_admin", "nso"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }

    if (!isGlobalAdmin) {
      if (role === "superadmin") {
        throw new Error("Team admins cannot invite super admin users");
      }
    }

    const resolvedTeam =
      role === "superadmin"
        ? null
        : isGlobalAdmin
        ? team ?? null
        : userProfile?.team ?? null;

    const validTeams = ["ce", "staffing", "experts"];
    if (role !== "superadmin") {
      if (!resolvedTeam || !validTeams.includes(resolvedTeam)) {
        throw new Error("A valid team is required for this role");
      }
      if (!isGlobalAdmin && resolvedTeam !== userProfile?.team) {
        throw new Error("Team admins can only invite users to their own team");
      }
    }

    // Check if user already exists.
    // listUsers is paginated, so iterate pages to avoid false negatives.
    let page = 1;
    const perPage = 200;
    let userExists = false;

    while (true) {
      const { data: listedUsers, error: listUsersError } =
        await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

      if (listUsersError) {
        console.error("Error listing users:", listUsersError);
        throw new Error(
          `Failed to validate existing users: ${listUsersError.message}`,
        );
      }

      const users = listedUsers.users ?? [];
      userExists = users.some(
        (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
      );

      if (userExists || users.length < perPage) {
        break;
      }

      page += 1;
    }

    if (userExists) {
      throw new Error("User with this email already exists");
    }

    // Create user with the provided password
    // Set email_confirm: true so user can log in immediately without email verification
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Email is already confirmed, user can log in immediately
      user_metadata: {
        full_name,
        role,
        team: resolvedTeam,
      },
    });

    if (createError || !newUser.user) {
      console.error("Error creating user:", createError);
      const reason = createError?.message
        ? `: ${createError.message}`
        : "";
      throw new Error(`Failed to create user${reason}`);
    }

    console.log("User created successfully:", newUser.user.id);

    // Ensure profile exists and set role/team
    const { error: roleUpdateError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUser.user.id,
          email,
          full_name,
          role,
          team: resolvedTeam,
        },
        { onConflict: "id" },
      );

    if (roleUpdateError) {
      console.error("Error assigning role:", roleUpdateError);
      // Clean up: delete the user if role assignment fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      const hint =
        role === "nso"
          ? " If the NSO role was added recently, apply the migration that runs ALTER TYPE app_role ADD VALUE 'nso' before using it."
          : "";
      throw new Error(
        `Failed to assign role to user: ${roleUpdateError.message}${hint}`
      );
    }

    console.log("Role assigned successfully");

    // Use production URL - ALWAYS use production URL, never localhost
    // Redirect to root URL which will take user to login page
    const siteUrl = Deno.env.get("SITE_URL") || "https://crmportal.lovable.app";
    // Ensure we never use localhost - always use production root URL
    const verifyUrl = siteUrl.includes("localhost") ? "https://crmportal.lovable.app" : siteUrl;
    
    console.log("Verify URL:", verifyUrl);

    // Send invitation email
    const roleLabels: Record<string, string> = {
      kam: "Key Account Manager",
      manager: "Manager",
      leadership: "Leadership",
      superadmin: "Super Admin",
      team_admin: "Team Admin",
      nso: "New Sales Officer",
    };

    const inviteContentHtml = [
      emailParagraph(`Hi ${full_name},`),
      emailParagraph(
        `You've been invited to join <strong>Awign CRM</strong> (Mandates Portal) as a <strong>${roleLabels[role]}</strong>.`,
      ),
      emailParagraph(
        "Your account has been created and is ready to use. Click the button below to verify your account and sign in:",
      ),
      emailButton(verifyUrl, "Verify Account"),
      emailInfoBox(
        `<strong>Your account details</strong><br><br>
        Email: ${email}<br>
        Role: ${roleLabels[role]}<br><br>
        <strong>Note:</strong> Your password has been set. Sign in with your email and password after verification.`,
      ),
      emailParagraph("If you have any questions, please contact your administrator."),
      emailSignature(["Team Awign CRM"]),
    ].join("");

    if (!skip_welcome_email) {
      const emailResponse = await resend.emails.send({
        from: EMAIL_FROM,
        to: [email],
        subject: "Welcome to Awign CRM — Your Account is Ready",
        html: wrapBrandedEmail({
          title: "Welcome to Awign CRM",
          subtitle: "Your account is ready",
          preheader: "Verify your account to access the Mandates Portal.",
          contentHtml: inviteContentHtml,
          siteUrl: site_url,
        }),
      });

      console.log("Email sent successfully:", emailResponse);
    } else {
      console.log("Welcome email skipped (portal email sending disabled)");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "User invited successfully",
        email_skipped: skip_welcome_email,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role: role,
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: unknown) {
    console.error("Error in invite-user function:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while inviting the user";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
};

serve(handler);
