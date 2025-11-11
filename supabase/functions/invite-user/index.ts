import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError || !userRoles?.some(r => r.role === "superadmin")) {
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

    // Create user with a temporary password (they'll set their own via magic link)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createError || !newUser.user) {
      console.error("Error creating user:", createError);
      throw new Error("Failed to create user");
    }

    console.log("User created successfully:", newUser.user.id);

    // Assign role to user
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role,
      });

    if (roleInsertError) {
      console.error("Error assigning role:", roleInsertError);
      // Clean up: delete the user if role assignment fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error("Failed to assign role to user");
    }

    console.log("Role assigned successfully");

    // Generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (resetError || !resetData) {
      console.error("Error generating reset link:", resetError);
      throw new Error("Failed to generate password setup link");
    }

    console.log("Password reset link generated");

    // Get the origin from the request
    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || supabaseUrl;
    
    // Create the setup password URL
    const setupUrl = `${origin}/auth?type=recovery&access_token=${resetData.properties.action_link.split('access_token=')[1]}`;

    // Send invitation email
    const roleLabels = {
      kam: "Key Account Manager",
      manager: "Manager",
      leadership: "Leadership",
      superadmin: "Super Admin",
    };

    const emailResponse = await resend.emails.send({
      from: "CRM Pro <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to CRM Pro - Set Up Your Account",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, hsl(200, 95%, 45%), hsl(195, 85%, 50%));
                color: white;
                padding: 30px;
                border-radius: 8px 8px 0 0;
                text-align: center;
              }
              .content {
                background: #f8f9fa;
                padding: 30px;
                border-radius: 0 0 8px 8px;
              }
              .button {
                display: inline-block;
                background: hsl(200, 95%, 45%);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
              }
              .info-box {
                background: white;
                padding: 15px;
                border-left: 4px solid hsl(200, 95%, 45%);
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Welcome to CRM Pro!</h1>
            </div>
            <div class="content">
              <p>Hi ${full_name},</p>
              
              <p>You've been invited to join CRM Pro as a <strong>${roleLabels[role]}</strong>.</p>
              
              <p>To get started, please click the button below to set up your password and access your account:</p>
              
              <div style="text-align: center;">
                <a href="${setupUrl}" class="button">Set Up Your Password</a>
              </div>
              
              <div class="info-box">
                <strong>Your Account Details:</strong><br>
                Email: ${email}<br>
                Role: ${roleLabels[role]}
              </div>
              
              <p>This link will expire in 24 hours for security reasons.</p>
              
              <p>If you have any questions, please contact your administrator.</p>
              
              <p>Best regards,<br>The CRM Pro Team</p>
            </div>
            <div class="footer">
              <p>© 2025 CRM Pro. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "User invited successfully",
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
