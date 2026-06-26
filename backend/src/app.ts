import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env, isProduction } from "./config/env.js";
import { supabaseProxy } from "./lib/supabaseProxy.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(morgan(isProduction ? "combined" : "dev"));

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      allowedHeaders: [
        "authorization",
        "apikey",
        "content-type",
        "x-client-info",
        "x-supabase-api-version",
        "prefer",
        "range",
        "x-upsert",
        "accept-profile",
        "content-profile",
      ],
      // Supabase uses Content-Range for counts and Range for storage; expose them.
      exposedHeaders: ["content-range", "content-length", "x-total-count"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    }),
  );

  // Health check (used by Docker/load balancers). Defined BEFORE the proxy and
  // outside Supabase's path space so it is never forwarded.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "grow-flow-desk-backend", uptime: process.uptime() });
  });

  app.get("/", (_req, res) => {
    res.json({
      service: "grow-flow-desk-backend",
      message: "Supabase gateway. Frontend talks here; this server talks to Supabase.",
    });
  });

  // IMPORTANT: do not register a body parser before the proxy, or POST/PATCH
  // bodies would be consumed and not forwarded to Supabase.
  app.use(supabaseProxy);

  return app;
}
