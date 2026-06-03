import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type QuestionRow = {
  field_key: string;
  label: string;
  input_type: string;
  required: boolean;
  options: unknown;
};

function parseOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => String(o).trim()).filter(Boolean);
}

function validateAnswers(
  questions: QuestionRow[],
  answers: Record<string, unknown>,
): string | null {
  for (const q of questions) {
    const raw = answers[q.field_key];
    const str = raw === undefined || raw === null ? "" : String(raw).trim();

    if (q.input_type === "rating") {
      const num = typeof raw === "number" ? raw : Number(str);
      if (q.required && (!Number.isInteger(num) || num < 1 || num > 5)) {
        return `"${q.label}" requires a rating from 1 to 5.`;
      }
      if (str !== "" && (!Number.isInteger(num) || num < 1 || num > 5)) {
        return `"${q.label}" must be a rating from 1 to 5.`;
      }
      continue;
    }

    if (q.required && !str) {
      return `"${q.label}" is required.`;
    }

    if (q.input_type === "single_choice" && str) {
      const opts = parseOptions(q.options);
      if (opts.length > 0 && !opts.includes(str)) {
        return `"${q.label}" has an invalid selection.`;
      }
    }
  }
  return null;
}

function normalizeAnswersForStorage(
  questions: QuestionRow[],
  answers: Record<string, unknown>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const q of questions) {
    const raw = answers[q.field_key];
    if (q.input_type === "rating") {
      const num = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
      out[q.field_key] = num;
    } else {
      out[q.field_key] = String(raw ?? "").trim();
    }
  }
  return out;
}

interface SubmitNpsSurveyRequest {
  token: string;
  answers: Record<string, unknown>;
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
    const { token, answers: rawAnswers } = body;

    if (!token?.trim()) {
      throw new Error("Survey token is required");
    }

    if (!rawAnswers || typeof rawAnswers !== "object") {
      throw new Error("Survey answers are required");
    }

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("nps_survey_questions")
      .select("field_key, label, input_type, required, options")
      .order("sort_order", { ascending: true });

    if (questionsError) throw questionsError;
    if (!questions?.length) {
      throw new Error("Survey form is not configured");
    }

    const validationError = validateAnswers(questions as QuestionRow[], rawAnswers);
    if (validationError) {
      throw new Error(validationError);
    }

    const emailAnswer = String(rawAnswers.email ?? "").trim();
    if (!emailAnswer) {
      throw new Error("Email is required");
    }

    const storedAnswers = normalizeAnswersForStorage(questions as QuestionRow[], rawAnswers);

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("nps_survey_invites")
      .select("id, contact_id, submitted_at, contact:contacts (email)")
      .eq("token", token.trim())
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) throw new Error("Invalid or expired survey link");
    if (invite.submitted_at) throw new Error("This survey has already been submitted");

    const contact = invite.contact as { email: string } | null;
    if (!contact?.email) throw new Error("Contact not found");

    if (contact.email.toLowerCase() !== emailAnswer.toLowerCase()) {
      throw new Error("Email does not match the survey recipient");
    }

    const { error: insertError } = await supabaseAdmin.from("nps_responses").insert({
      invite_id: invite.id,
      contact_id: invite.contact_id,
      email: emailAnswer,
      answers: storedAnswers,
    });

    if (insertError) throw insertError;

    const { error: updateError } = await supabaseAdmin
      .from("nps_survey_invites")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateError) throw updateError;

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
