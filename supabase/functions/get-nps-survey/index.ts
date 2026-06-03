import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GetNpsSurveyRequest {
  token: string;
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

    const { token }: GetNpsSurveyRequest = await req.json();

    if (!token?.trim()) {
      throw new Error("Survey token is required");
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("nps_survey_invites")
      .select(`
        id,
        submitted_at,
        contact:contacts (
          email,
          first_name,
          last_name
        )
      `)
      .eq("token", token.trim())
      .maybeSingle();

    if (inviteError) {
      throw inviteError;
    }

    if (!invite) {
      throw new Error("Invalid or expired survey link");
    }

    const contact = invite.contact as {
      email: string;
      first_name: string;
      last_name: string;
    } | null;

    if (!contact?.email) {
      throw new Error("Contact not found for this survey");
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        already_submitted: Boolean(invite.submitted_at),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to load survey";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
