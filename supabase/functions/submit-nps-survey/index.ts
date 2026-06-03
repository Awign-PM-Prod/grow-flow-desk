import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REFERRAL_OPTIONS = ["Yes", "No", "Maybe"] as const;
const LEADERSHIP_OPTIONS = [
  "Yes, We have Met Virtually",
  "Yes, We have met personally",
  "No",
] as const;

interface SubmitNpsSurveyRequest {
  token: string;
  email: string;
  satisfaction_services: number;
  satisfaction_project_execution: number;
  gig_workforce_quality: number;
  poc_overall_communication: number;
  poc_escalation_handling: number;
  poc_availability: number;
  poc_proactive_approach: number;
  poc_timely_response: number;
  poc_requirement_understanding: number;
  referral_intent: string;
  leadership_meeting: string;
  services_meet_needs: number;
  improve_suggestions: string;
  other_comments: string;
}

function assertRating(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${field} must be an integer from 1 to 5`);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body: SubmitNpsSurveyRequest = await req.json();
    const { token } = body;

    if (!token?.trim()) {
      throw new Error("Survey token is required");
    }

    const email = body.email?.trim();
    if (!email) {
      throw new Error("Email is required");
    }

    const improveSuggestions = body.improve_suggestions?.trim();
    const otherComments = body.other_comments?.trim();
    if (!improveSuggestions) {
      throw new Error("What can Awign do better? is required");
    }
    if (!otherComments) {
      throw new Error("Other comments, questions or concerns is required");
    }

    if (!REFERRAL_OPTIONS.includes(body.referral_intent as typeof REFERRAL_OPTIONS[number])) {
      throw new Error("Invalid referral response");
    }

    if (!LEADERSHIP_OPTIONS.includes(body.leadership_meeting as typeof LEADERSHIP_OPTIONS[number])) {
      throw new Error("Invalid leadership meeting response");
    }

    const ratingFields: Array<[number, string]> = [
      [body.satisfaction_services, "How satisfied are you with Awign's services?"],
      [body.satisfaction_project_execution, "How satisfied are you on Project Execution?"],
      [body.gig_workforce_quality, "How do you rate Awign's Gig Workforce Quality?"],
      [body.poc_overall_communication, "Overall Communication"],
      [body.poc_escalation_handling, "Escalation Handling"],
      [body.poc_availability, "Availability"],
      [body.poc_proactive_approach, "Proactive Approach"],
      [body.poc_timely_response, "Timely Response"],
      [body.poc_requirement_understanding, "Project Requirement Understanding"],
      [body.services_meet_needs, "How well do our services meet your needs?"],
    ];

    for (const [value, label] of ratingFields) {
      assertRating(value, label);
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("nps_survey_invites")
      .select("id, contact_id, submitted_at, contact:contacts (email)")
      .eq("token", token.trim())
      .maybeSingle();

    if (inviteError) {
      throw inviteError;
    }

    if (!invite) {
      throw new Error("Invalid or expired survey link");
    }

    if (invite.submitted_at) {
      throw new Error("This survey has already been submitted");
    }

    const contact = invite.contact as { email: string } | null;
    if (!contact?.email) {
      throw new Error("Contact not found");
    }

    if (contact.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error("Email does not match the survey recipient");
    }

    const { error: insertError } = await supabaseAdmin.from("nps_responses").insert({
      invite_id: invite.id,
      contact_id: invite.contact_id,
      email,
      satisfaction_services: body.satisfaction_services,
      satisfaction_project_execution: body.satisfaction_project_execution,
      gig_workforce_quality: body.gig_workforce_quality,
      poc_overall_communication: body.poc_overall_communication,
      poc_escalation_handling: body.poc_escalation_handling,
      poc_availability: body.poc_availability,
      poc_proactive_approach: body.poc_proactive_approach,
      poc_timely_response: body.poc_timely_response,
      poc_requirement_understanding: body.poc_requirement_understanding,
      referral_intent: body.referral_intent,
      leadership_meeting: body.leadership_meeting,
      services_meet_needs: body.services_meet_needs,
      improve_suggestions: improveSuggestions,
      other_comments: otherComments,
    });

    if (insertError) {
      throw insertError;
    }

    const { error: updateError } = await supabaseAdmin
      .from("nps_survey_invites")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Survey submitted successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: unknown) {
    console.error("Error in submit-nps-survey:", error);
    const message = error instanceof Error ? error.message : "Failed to submit survey";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
