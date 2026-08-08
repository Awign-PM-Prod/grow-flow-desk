import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAppSiteUrl } from "@/lib/app-site-url";
import { parseEdgeFunctionError } from "@/lib/edge-function-errors";
import {
  isPortalPasswordResetEmailEnabled,
  PORTAL_EMAIL_SENDING_DISABLED_MESSAGE,
} from "@/lib/portalEmailSending";
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

type RecoveryUrlInfo = {
  isRecovery: boolean;
  /** Present when Supabase bounced back with an expired/invalid link. */
  errorDescription: string | null;
};

/**
 * Read the recovery params before the Supabase client strips the URL hash
 * (detectSessionInUrl consumes it shortly after the client boots).
 */
function readRecoveryUrlInfo(): RecoveryUrlInfo {
  if (typeof window === "undefined") {
    return { isRecovery: false, errorDescription: null };
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);

  const type = hashParams.get("type") || queryParams.get("type");
  const error = hashParams.get("error") || queryParams.get("error");
  const errorDescription =
    hashParams.get("error_description") || queryParams.get("error_description");

  return {
    isRecovery: type === "recovery",
    errorDescription: error
      ? errorDescription || "Invalid or expired reset link. Please request a new one."
      : null,
  };
}

export default function Auth() {
  const [urlInfo] = useState(readRecoveryUrlInfo);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [isPasswordRecovery, setIsPasswordRecovery] = useState(urlInfo.isRecovery);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  useEffect(() => {
    if (urlInfo.errorDescription) {
      toast({
        title: "Error",
        description: urlInfo.errorDescription,
        variant: "destructive",
      });
      return;
    }

    if (urlInfo.isRecovery) {
      toast({
        title: "Set your password",
        description: "Please enter your new password below.",
      });
    }
  }, [urlInfo, toast]);

  // The recovery session may be established after first render, so rely on the
  // auth event too — otherwise the redirect below can win the race.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Redirect only when auth context confirms a user (avoids stale getSession after sign-out).
    if (!authLoading && user && !isPasswordRecovery) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, authLoading, user, isPasswordRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs (skip email validation for password recovery)
      if (!isPasswordRecovery) {
        const emailValidation = emailSchema.safeParse(email);
        if (!emailValidation.success) {
          toast({
            title: "Invalid email",
            description: emailValidation.error.errors[0].message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      if (isForgotPassword) {
        if (!isPortalPasswordResetEmailEnabled()) {
          toast({
            title: "Email sending disabled",
            description: PORTAL_EMAIL_SENDING_DISABLED_MESSAGE,
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke("send-password-reset", {
          body: {
            email: email.trim(),
            site_url: getAppSiteUrl(),
            self_service: true,
          },
        });

        if (error) {
          throw new Error(await parseEdgeFunctionError(error, data));
        }

        toast({
          title: "Check your email",
          description:
            "If an account exists for that email, a password reset link is on its way.",
        });
        setIsForgotPassword(false);
        setPassword("");
        return;
      }

      const passwordValidation = passwordSchema.safeParse(password);
      if (!passwordValidation.success) {
        toast({
          title: "Invalid password",
          description: passwordValidation.error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (isPasswordRecovery) {
        // Validate password confirmation
        if (password !== confirmPassword) {
          toast({
            title: "Passwords don't match",
            description: "Please make sure both passwords are the same.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        // Handle password setup/recovery
        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success!",
            description: "Your password has been set successfully. Please sign in with your new password.",
          });
          // End the short-lived recovery session so the next screen is a real login.
          await supabase.auth.signOut().catch(() => {});
          // Clear URL hash and redirect to login
          window.location.href = "/auth";
        }
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login failed",
              description: "Invalid email or password. Please try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          navigate("/dashboard");
        }
      } else {
        // Use production URL from environment variable, fallback to current origin for development
        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const redirectUrl = `${siteUrl}/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Success!",
            description: "Please check your email to confirm your account.",
          });
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isPasswordRecovery
              ? "Set Your Password"
              : isForgotPassword
              ? "Reset Your Password"
              : isLogin
              ? "Welcome Back"
              : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isPasswordRecovery
              ? "Create a password for your account"
              : isForgotPassword
              ? "Enter your email and we'll send you a reset link"
              : isLogin
              ? "Sign in to access your CRM dashboard"
              : "Get started with your CRM account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isPasswordRecovery && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            {!isPasswordRecovery && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">{isPasswordRecovery ? "New Password" : "Password"}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
            {isPasswordRecovery && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Loading..."
                : isPasswordRecovery
                ? "Set Password"
                : isForgotPassword
                ? "Send Reset Link"
                : isLogin
                ? "Sign In"
                : "Sign Up"}
            </Button>
            {!isPasswordRecovery && (
              <div className="space-y-2 text-center text-sm">
                {isForgotPassword ? (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-primary hover:underline"
                  >
                    Back to sign in
                  </button>
                ) : (
                  <>
                    {isLogin && (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setPassword("");
                          }}
                          className="text-primary hover:underline"
                        >
                          Forgot your password?
                        </button>
                      </div>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-primary hover:underline"
                      >
                        {isLogin
                          ? "Don't have an account? Sign up"
                          : "Already have an account? Sign in"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
