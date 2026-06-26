import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { supabaseProxy } from "./lib/supabaseProxy.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(
    `[backend] gateway listening on http://localhost:${env.port} -> ${env.supabaseUrl}`,
  );
  console.log(`[backend] allowed CORS origins: ${env.corsOrigins.join(", ")}`);
});

// Forward Supabase Realtime websocket upgrades through the same proxy.
if (typeof supabaseProxy.upgrade === "function") {
  server.on("upgrade", supabaseProxy.upgrade);
}

function shutdown(signal: string) {
  console.log(`[backend] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
