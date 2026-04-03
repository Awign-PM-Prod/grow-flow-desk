-- Append-only style log: ISO 8601 timestamp keys -> Activated | Deactivated.
ALTER TABLE public.mandates
  ADD COLUMN IF NOT EXISTS lifecycle_status_log jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.mandates.lifecycle_status_log IS 'ISO 8601 timestamp keys to Activated or Deactivated for each lifecycle toggle.';
