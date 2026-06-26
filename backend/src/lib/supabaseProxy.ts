import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import { env } from "../config/env.js";

/**
 * Path prefixes that make up Supabase's public API surface. The browser's
 * Supabase SDK is pointed at this backend, so it issues requests like
 * `/rest/v1/...`, `/auth/v1/...`, `/functions/v1/...`, etc. We forward each of
 * these to the real Supabase project untouched.
 */
export const SUPABASE_PROXY_PATHS = [
  "/rest",
  "/auth",
  "/functions",
  "/storage",
  "/realtime",
] as const;

const pathFilter = SUPABASE_PROXY_PATHS.map((prefix) => `${prefix}/**`);

/**
 * Authenticating gateway to Supabase.
 *
 * Security model: the browser never talks to Supabase directly. It talks to this
 * backend, which forwards the request to Supabase. We inject the public `apikey`
 * (anon key) and pass the caller's `Authorization: Bearer <jwt>` header straight
 * through, so Supabase Row Level Security continues to be enforced against the
 * logged-in user exactly as before. We deliberately do NOT use the service role
 * key here, which would bypass RLS.
 */
const proxyOptions: Options = {
  target: env.supabaseUrl,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  pathFilter,
  // Supabase returns row counts in the Content-Range header; make sure nothing
  // strips it on the way back to the browser.
  on: {
    proxyReq: (proxyReq) => {
      // Ensure the anon apikey is always present even if a caller omits it.
      if (!proxyReq.getHeader("apikey")) {
        proxyReq.setHeader("apikey", env.supabaseAnonKey);
      }
      // Supabase derives the request role from the Authorization bearer. The SDK
      // always sends it (user JWT when logged in, anon key when not). Default to
      // the anon key when absent so unauthenticated access still resolves to the
      // `anon` role instead of being rejected. A real user JWT is passed through
      // untouched, preserving RLS.
      if (!proxyReq.getHeader("authorization")) {
        proxyReq.setHeader("authorization", `Bearer ${env.supabaseAnonKey}`);
      }
    },
    error: (err, _req, res) => {
      // `res` can be a ServerResponse (HTTP) or a Socket (WebSocket upgrade).
      if ("writeHead" in res && !res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "Bad gateway", detail: err.message }),
        );
      } else if ("destroy" in res) {
        res.destroy();
      }
    },
  },
};

export const supabaseProxy = createProxyMiddleware(proxyOptions);
