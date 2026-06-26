import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy backend/.env.example to backend/.env and fill it in.`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Frontend origins allowed to call this gateway. Comma-separated.
 * The browser only ever talks to this backend, so CORS must permit the SPA origin.
 */
function parseOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number.parseInt(optional("PORT", "4000"), 10),
  corsOrigins: parseOrigins(optional("CORS_ORIGIN", "http://localhost:8080")),
  supabaseUrl: required("SUPABASE_URL").replace(/\/+$/, ""),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  /**
   * Optional. NOT used by the transparent gateway (which forwards the user's JWT
   * so Supabase RLS still applies). Only needed if you add privileged bespoke
   * endpoints later that must bypass RLS.
   */
  supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
} as const;

export const isProduction = env.nodeEnv === "production";
