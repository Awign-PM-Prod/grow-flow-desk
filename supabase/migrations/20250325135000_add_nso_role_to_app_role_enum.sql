-- Add NSO role to app_role enum.
-- NOTE: Must be in its own migration because new enum values can't be referenced
-- in the same transaction they're added (Supabase runs each migration in a transaction).

ALTER TYPE public.app_role ADD VALUE 'nso';

