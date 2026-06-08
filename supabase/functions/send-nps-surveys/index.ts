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

type Team = "ce" | "staffing" | "experts";

const EMAIL_SKIP_MESSAGE =
  "NPS survey emails are not sent for Staffing or Awign Expert teams";

function isEmailDisabledForTeam(team: Team | null | undefined): boolean {
  return team === "staffing" || team === "experts";
}

function buildNpsEmailHtml(surveyUrl: string, contactName: string, siteUrl?: string): string {
  const greeting = contactName ? `Hi ${contactName},` : "Hi,";
  const contentHtml = [
    emailParagraph(greeting),
    emailParagraph(
      "We value your partnership with Awign and would love your feedback on our services. The survey takes only a few minutes.",
    ),
    emailButton(surveyUrl, "Complete NPS Survey"),
    emailInfoBox(
      `<strong>Can't click the button?</strong><br>
      Copy and paste this link into your browser:<br>
      <a href="${surveyUrl}" style="color: #0678D4; word-break: break-all;">${surveyUrl}</a>`,
    ),
    emailParagraph("Thank you for your time — your input helps us serve you better."),
    emailSignature(["Team Awign"]),
  ].join("");

  return wrapBrandedEmail({
    title: "Share Your Feedback",
    subtitle: "Awign NPS Survey",
    preheader: "We'd appreciate a few minutes of your time for our feedback survey.",
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
    const bodyPayload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const siteUrl =
      Deno.env.get("SITE_URL") ||
      Deno.env.get("VITE_SITE_URL") ||
      (typeof bodyPayload?.site_url === "string" ? bodyPayload.site_url : "") ||
      "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
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
      throw new Error("Unable to verify admin profile");
    }

    const callerRole = callerProfile.role;
    const isGlobalAdmin = callerRole === "superadmin";
    const isTeamAdmin = callerRole === "team_admin";

    if (!isGlobalAdmin && !isTeamAdmin) {
      throw new Error("Only admins can send NPS surveys");
    }

    const callerTeam = callerProfile.team as Team | null;
    if (isTeamAdmin && !isGlobalAdmin && isEmailDisabledForTeam(callerTeam)) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: EMAIL_SKIP_MESSAGE,
          emails_sent: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    let accountIds: string[] | null = null;
    if (isTeamAdmin && !isGlobalAdmin) {
      if (!callerTeam) {
        throw new Error("Team admin has no team assigned");
      }
      const { data: mandates, error: mandatesError } = await supabaseAdmin
        .from("mandates")
        .select("account_id")
        .eq("team", callerTeam)
        .not("account_id", "is", null);

      if (mandatesError) {
        throw mandatesError;
      }

      accountIds = [
        ...new Set(
          (mandates || [])
            .map((m) => m.account_id as string)
            .filter(Boolean),
        ),
      ];

      if (accountIds.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "No accounts found for your team",
            emails_sent: 0,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    // Superadmin bulk send: only CE-team mandate accounts (exclude staffing / experts).
    if (isGlobalAdmin) {
      const { data: ceMandates, error: ceMandatesError } = await supabaseAdmin
        .from("mandates")
        .select("account_id")
        .eq("team", "ce")
        .not("account_id", "is", null);

      if (ceMandatesError) {
        throw ceMandatesError;
      }

      accountIds = [
        ...new Set(
          (ceMandates || [])
            .map((m) => m.account_id as string)
            .filter(Boolean),
        ),
      ];

      if (accountIds.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "No CE team accounts found for NPS",
            emails_sent: 0,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    let contactsQuery = supabaseAdmin
      .from("contacts")
      .select("id, email, first_name, last_name, account_id")
      .eq("nps_enabled", true);

    if (accountIds) {
      contactsQuery = contactsQuery.in("account_id", accountIds);
    }

    const { data: contacts, error: contactsError } = await contactsQuery;
    if (contactsError) {
      throw contactsError;
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No contacts with NPS enabled",
          emails_sent: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!siteUrl) {
      throw new Error("SITE_URL is not configured for survey links");
    }

    const baseUrl = siteUrl.replace(/\/$/, "");
    let emailsSent = 0;
    const failures: string[] = [];

    for (const contact of contacts) {
      const email = contact.email?.trim();
      if (!email) {
        failures.push(contact.id);
        continue;
      }

      const { data: invite, error: inviteError } = await supabaseAdmin
        .from("nps_survey_invites")
        .insert({
          contact_id: contact.id,
          sent_by: user.id,
        })
        .select("token")
        .single();

      if (inviteError || !invite?.token) {
        console.error("Failed to create invite for contact", contact.id, inviteError);
        failures.push(email);
        continue;
      }

      const surveyUrl = `${baseUrl}/nps/${invite.token}`;
      const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();

      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: [email],
          subject: "Share Your Feedback — Awign NPS Survey",
          html: buildNpsEmailHtml(surveyUrl, contactName, siteUrl),
        });
        emailsSent += 1;
      } catch (sendError) {
        console.error(`Failed to send NPS email to ${email}:`, sendError);
        failures.push(email);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "NPS survey emails processed",
        emails_sent: emailsSent,
        total_contacts: contacts.length,
        failed_recipients: failures,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: unknown) {
    console.error("Error in send-nps-surveys:", error);
    const message = error instanceof Error ? error.message : "Failed to send NPS surveys";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
