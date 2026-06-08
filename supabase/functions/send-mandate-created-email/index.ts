import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  EMAIL_FROM,
  emailDetailCard,
  emailParagraph,
  emailSectionTitle,
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

interface SendMandateCreatedEmailRequest {
  account_id: string;
  mandate_name: string;
  lob: string;
  kam_id: string;
  created_on?: string;
  site_url?: string;
}

const EMAIL_SKIP_MESSAGE =
  "Mandate notification emails are not sent for Staffing or Awign Expert teams";

function isEmailDisabledForTeam(team: Team | null | undefined): boolean {
  return team === "staffing" || team === "experts";
}

function teamFromLob(lob: string | null | undefined): Team | null {
  const normalized = (lob || "").toLowerCase().trim().replace(/\s+/g, " ");
  if (normalized === "staffing") return "staffing";
  if (normalized === "awign expert" || normalized === "awign experts") {
    return "experts";
  }
  if (normalized) return "ce";
  return null;
}

function formatCreatedDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildMandateCreatedEmailHtml(
  mandateName: string,
  createdOn: string,
  lob: string,
  pocName: string,
  pocEmail: string,
  siteUrl?: string,
): string {
  const contentHtml = [
    emailParagraph("Hi Team,"),
    emailParagraph("A new mandate has been successfully created on Awign CRM. Details are below."),
    emailSectionTitle("Mandate Details"),
    emailDetailCard([
      { label: "Mandate Name", value: mandateName },
      { label: "Created On", value: createdOn },
      { label: "Business Unit", value: lob },
    ]),
    emailParagraph(
      "For any support related to this mandate or platform operations, your designated point of contact is:",
    ),
    emailSectionTitle("POC Details"),
    emailDetailCard([
      { label: "Name", value: pocName },
      { label: "Email", value: pocEmail },
    ]),
    emailParagraph("Please feel free to reach out in case of any assistance."),
    emailSignature(["Team Awign"]),
  ].join("");

  return wrapBrandedEmail({
    title: "New Mandate Added",
    subtitle: mandateName,
    preheader: `New mandate ${mandateName} has been created.`,
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

    const {
      account_id,
      mandate_name,
      lob,
      kam_id,
      created_on,
      site_url,
    }: SendMandateCreatedEmailRequest = await req.json();

    if (!account_id) {
      throw new Error("Account is required");
    }

    if (!mandate_name?.trim()) {
      throw new Error("Mandate name is required");
    }

    if (!lob?.trim()) {
      throw new Error("Business unit is required");
    }

    if (!kam_id) {
      throw new Error("KAM is required");
    }

    const { data: kamProfile, error: kamError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, team")
      .eq("id", kam_id)
      .single();

    if (kamError || !kamProfile) {
      throw new Error("KAM profile not found");
    }

    const mandateTeam =
      (kamProfile.team as Team | null) ?? teamFromLob(lob);
    if (isEmailDisabledForTeam(mandateTeam)) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: EMAIL_SKIP_MESSAGE,
          emails_sent: 0,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const pocName = kamProfile.full_name?.trim() || "Awign Team";
    const pocEmail = kamProfile.email?.trim();
    if (!pocEmail) {
      throw new Error("KAM email not found");
    }

    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("contacts")
      .select("id, email")
      .eq("account_id", account_id)
      .not("email", "is", null);

    if (contactsError) {
      throw new Error("Unable to fetch account contacts");
    }

    const recipientEmails = [
      ...new Set(
        (contacts || [])
          .map((contact) => contact.email?.trim())
          .filter((email): email is string => Boolean(email)),
      ),
    ];

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No contacts with email found for this account",
          emails_sent: 0,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const createdOn = formatCreatedDate(created_on);
    const html = buildMandateCreatedEmailHtml(
      mandate_name.trim(),
      createdOn,
      lob.trim(),
      pocName,
      pocEmail,
      site_url,
    );

    let emailsSent = 0;
    const failures: string[] = [];

    for (const recipientEmail of recipientEmails) {
      try {
        const emailResponse = await resend.emails.send({
          from: EMAIL_FROM,
          to: [recipientEmail],
          subject: "New Mandate Added",
          html,
        });
        console.log(`Mandate created email sent to ${recipientEmail}:`, emailResponse);
        emailsSent += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed to send mandate email to ${recipientEmail}:`, message);
        failures.push(recipientEmail);
      }
    }

    if (emailsSent === 0) {
      throw new Error("Failed to send mandate notification emails");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Mandate notification emails sent successfully",
        emails_sent: emailsSent,
        failed_recipients: failures,
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
    console.error("Error in send-mandate-created-email function:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while sending the mandate notification email";
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
