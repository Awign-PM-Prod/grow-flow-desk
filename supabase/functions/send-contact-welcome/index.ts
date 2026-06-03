import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  EMAIL_FROM,
  emailInfoBox,
  emailParagraph,
  emailSignature,
  escapeHtml,
  wrapBrandedEmail,
} from "./email-theme.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AppRole = "kam" | "manager" | "leadership" | "superadmin" | "team_admin" | "nso";
type Team = "ce" | "staffing" | "experts";

interface SendContactWelcomeRequest {
  contact_email: string;
  poc_user_id: string;
  site_url?: string;
}

function teamDisplayName(team: Team | null): string {
  switch (team) {
    case "ce":
      return "CE";
    case "staffing":
      return "Staffing";
    case "experts":
      return "Experts";
    default:
      return "Awign";
  }
}

function roleDesignation(role: AppRole | null | undefined): string {
  switch (role) {
    case "kam":
      return "Key Account Manager";
    case "manager":
      return "Manager";
    case "leadership":
      return "Leadership";
    case "team_admin":
      return "Team Admin";
    case "superadmin":
      return "Super Admin";
    case "nso":
      return "New Sales Officer";
    default:
      return "Awign";
  }
}

function buildWelcomeEmailHtml(
  pocName: string,
  departmentName: string,
  designation: string,
  siteUrl?: string,
): string {
  const safeName = escapeHtml(pocName);
  const safeDept = escapeHtml(departmentName);
  const safeDesignation = escapeHtml(designation);
  const contentHtml = [
    emailParagraph("Hi Team,"),
    emailParagraph("Hope you're doing well."),
    emailParagraph(
      `I wanted to take a moment to introduce myself. I'm <strong>${safeName}</strong> from the <strong>${safeDept}</strong> team at Awign, and I'll be your primary point of contact.`,
    ),
    emailInfoBox(
      `<strong style="font-size: 15px;">Your point of contact</strong><br><br>
      <span style="font-size: 16px; color: #0678D4;"><strong>${safeName}</strong></span><br>
      ${safeDesignation}<br>
      ${safeDept} Team &middot; Awign`,
    ),
    emailParagraph(
      "We're excited to partner with your team and ensure a smooth experience at Awign. Please feel free to reach out anytime for questions or support.",
    ),
    emailParagraph("Looking forward to working together!"),
    emailSignature([pocName, designation, "Awign"]),
  ].join("");

  return wrapBrandedEmail({
    title: "Introduction",
    subtitle: "Your point of contact at Awign",
    preheader: `${pocName} from the ${departmentName} team will be your Awign POC.`,
    contentHtml,
    siteUrl,
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role, team")
      .eq("id", user.id)
      .single();

    if (callerError || !callerProfile) {
      throw new Error("Unable to verify caller profile");
    }

    const callerRole = callerProfile.role as AppRole;
    const isGlobalAdmin = callerRole === "superadmin";
    const isTeamAdmin = callerRole === "team_admin";
    const isAdmin = isGlobalAdmin || isTeamAdmin;

    const { contact_email, poc_user_id, site_url }: SendContactWelcomeRequest = await req.json();

    if (!contact_email?.trim()) {
      throw new Error("Contact email is required");
    }

    if (!poc_user_id) {
      throw new Error("Point of contact user is required");
    }

    if (!isAdmin && poc_user_id !== user.id) {
      throw new Error("You can only send welcome emails as yourself");
    }

    const { data: pocProfile, error: pocError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, team")
      .eq("id", poc_user_id)
      .single();

    if (pocError || !pocProfile) {
      throw new Error("Point of contact user not found");
    }

    if (isTeamAdmin && !isGlobalAdmin) {
      const callerTeam = callerProfile.team as Team | null;
      const pocTeam = pocProfile.team as Team | null;
      if (!callerTeam || callerTeam !== pocTeam) {
        throw new Error("Team admins can only select KAMs from their own team");
      }
    }

    const pocName = pocProfile.full_name?.trim() || "Awign Team";
    const departmentName = teamDisplayName(pocProfile.team as Team | null);
    const designation = roleDesignation(pocProfile.role as AppRole);

    const emailResponse = await resend.emails.send({
      from: EMAIL_FROM,
      to: [contact_email.trim()],
      subject: "Introduction | Your Point of Contact at Awign",
      html: buildWelcomeEmailHtml(pocName, departmentName, designation, site_url),
    });

    console.log("Contact welcome email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error: unknown) {
    console.error("Error in send-contact-welcome function:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while sending the welcome email";
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
