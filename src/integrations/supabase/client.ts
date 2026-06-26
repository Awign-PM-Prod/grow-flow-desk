// The Supabase client is pointed at our own backend gateway, not Supabase.
// The browser only ever talks to the backend (VITE_API_URL); the backend
// forwards REST / Auth / Functions / Storage / Realtime to Supabase while
// preserving the user's JWT so Row Level Security still applies.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const API_URL =
  import.meta.env.VITE_API_URL?.trim() || "http://localhost:4000";

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
