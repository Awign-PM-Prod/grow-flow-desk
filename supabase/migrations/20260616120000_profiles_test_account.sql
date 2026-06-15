-- Flag test users so they can be excluded from dashboard metrics and filters.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS test_account BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.test_account IS
  'When true, this user is hidden from dashboard filters and their assigned data is excluded from dashboard rollups.';
