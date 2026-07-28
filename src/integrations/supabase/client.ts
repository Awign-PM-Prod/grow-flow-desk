// The Supabase client is pointed at our own backend gateway, not Supabase.
// The browser only ever talks to the gateway (VITE_API_URL / same origin); the
// backend forwards REST / Auth / Functions / Storage / Realtime to Supabase
// while preserving the user's JWT so Row Level Security still applies.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Resolve the gateway URL the browser should call.
 *
 * - Local dev: Vite is on :8080, gateway on :4000 → use VITE_API_URL as-is.
 * - Production HTTPS behind nginx (API proxied on same origin): use page origin
 *   so Mixed Content cannot occur if VITE_API_URL was baked as http://.
 */
function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim() || "";

  if (typeof window !== "undefined") {
    const { protocol, hostname, origin } = window.location;

    // Production domain with nginx API proxy: always same-origin.
    if (
      protocol === "https:" &&
      (hostname === "awigncrm.awignhub.in" || hostname.endsWith(".awignhub.in"))
    ) {
      return origin;
    }

    if (configured) {
      try {
        const configuredUrl = new URL(configured);
        const configuredOrigin = configuredUrl.origin;
        // Only collapse to page origin when host AND port match (true same-origin).
        // localhost:8080 vs localhost:4000 must stay distinct for local Vite + gateway.
        if (configuredOrigin === origin) {
          return origin;
        }
        // Page is HTTPS but config is HTTP on another host → upgrade scheme.
        if (protocol === "https:" && configuredUrl.protocol === "http:") {
          configuredUrl.protocol = "https:";
          return configuredUrl.toString().replace(/\/$/, "");
        }
        return configured.replace(/\/$/, "");
      } catch {
        // fall through
      }
    }
  }

  return configured || "http://localhost:4000";
}

const API_URL = resolveApiUrl();

// The anon key is public and still required by the Supabase SDK; the backend
// forwards it (and injects it if missing). It is NOT a secret.
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cmdmYXVrbm5penplYnZpZ3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTAwMzcsImV4cCI6MjA3ODQyNjAzN30.J32rDD3amn3SbWvxJKeq1hIgs5WUlWwyf54BMs_Xyqk";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(API_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
