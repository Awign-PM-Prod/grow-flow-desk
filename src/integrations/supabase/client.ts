// The Supabase client is pointed at our own backend gateway, not Supabase.
// The browser only ever talks to the gateway (VITE_API_URL / same origin); the
// backend forwards REST / Auth / Functions / Storage / Realtime to Supabase
// while preserving the user's JWT so Row Level Security still applies.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Resolve the gateway URL the browser should call.
 *
 * When the SPA is served over HTTPS and the API host is the same as the page
 * (nginx proxies /auth/v1, /rest/v1, … to the backend), always use
 * window.location.origin. That prevents Mixed Content if VITE_API_URL was
 * accidentally baked as http:// during docker build.
 */
function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim() || "";

  if (typeof window !== "undefined") {
    const { protocol, hostname, origin } = window.location;

    if (configured) {
      try {
        const configuredUrl = new URL(configured);
        if (configuredUrl.hostname === hostname) {
          // Same host as the page → match the page protocol/origin exactly.
          return origin;
        }
        // Page is HTTPS but config is HTTP on another host → upgrade scheme.
        if (protocol === "https:" && configuredUrl.protocol === "http:") {
          configuredUrl.protocol = "https:";
          return configuredUrl.toString().replace(/\/$/, "");
        }
      } catch {
        // fall through
      }
    }

    // Production domain with nginx API proxy: same-origin by default.
    if (
      protocol === "https:" &&
      (hostname === "awigncrm.awignhub.in" || hostname.endsWith(".awignhub.in"))
    ) {
      return origin;
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
