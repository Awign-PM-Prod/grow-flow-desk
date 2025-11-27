import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  full_name: string;
  role: "kam" | "manager" | "leadership" | "superadmin";
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
      throw new Error("Only superadmins can invite users");
    }

    const { email, full_name, role }: InviteUserRequest = await req.json();

    console.log("Inviting user:", { email, full_name, role });

    // Validate input
    if (!email || !full_name || !role) {
      throw new Error("Missing required fields");
    }

    const validRoles = ["kam", "manager", "leadership", "superadmin"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser.users.some(u => u.email === email);

    if (userExists) {
      throw new Error("User with this email already exists");
    }

    // Get the redirect URL from the request origin
    const origin = req.headers.get("origin") || req.headers.get("referer");
    let redirectTo = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/auth`;
    
    if (origin) {
      // Extract the base URL from origin
      const url = new URL(origin);
      redirectTo = `${url.origin}/auth`;
    }

    console.log("Redirect URL:", redirectTo);

    // Invite user using Supabase's built-in invitation system
    // This will create the user and send an invitation email automatically
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name,
        },
        redirectTo,
      }
    );

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      throw new Error(inviteError.message);
    }

    console.log("User invited successfully:", inviteData.user?.id);

    // Update the user's role in the profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role, full_name })
      .eq("id", inviteData.user!.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Don't fail the entire operation if profile update fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "User invited successfully. They will receive an email with instructions to set their password.",
        user: {
          id: inviteData.user!.id,
          email: inviteData.user!.email,
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
  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "An error occurred while inviting the user" 
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
