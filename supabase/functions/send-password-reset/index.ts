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

interface PasswordResetRequest {
  email: string;
  full_name: string;
  site_url?: string;
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

    // Check if user has superadmin role
    const { data: userProfile, error: roleError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError || userProfile?.role !== "superadmin") {
      throw new Error("Only superadmins can send password reset links");
    }

    const { email, full_name, site_url }: PasswordResetRequest = await req.json();

    console.log("Sending password reset link to:", email);

    // Validate input
    if (!email) {
      throw new Error("Email is required");
    }

    // Generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (resetError || !resetData) {
      console.error("Error generating reset link:", resetError);
      throw new Error("Failed to generate password reset link");
    }

    console.log("Password reset link generated");

    // Use the action link directly from Supabase
    const actionLink = resetData.properties.action_link;
    
    console.log("Action link:", actionLink);

    // Send password reset email
    const resetContentHtml = [
      emailParagraph(`Hi ${full_name || "there"},`),
      emailParagraph(
        "Your administrator has sent you a password reset link for your Awign CRM account.",
      ),
      emailParagraph("Click the button below to set up a new password:"),
      emailButton(actionLink, "Reset Your Password"),
      emailInfoBox(
        `<strong>Security notice</strong><br><br>
        This link will expire in 24 hours for security reasons.<br>
        If you didn't request this reset, please contact your administrator.`,
      ),
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
        siteUrl: site_url,
      }),
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Password reset link sent successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "An error occurred while sending the password reset link" 
      }),
      {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
