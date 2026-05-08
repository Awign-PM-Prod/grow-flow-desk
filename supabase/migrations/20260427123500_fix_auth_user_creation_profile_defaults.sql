-- Fix "Database error creating new user" during auth.admin.createUser().
-- Root cause: auth trigger inserts into public.profiles can fail when
-- schema has mandatory columns (for example role/team) without safe defaults.

-- Ensure role/team columns (if present) don't block profile creation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT ''kam''::public.app_role';
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'team'
  ) THEN
    -- Keep this generic (no explicit type cast) so it works whether team is
    -- text or an enum type.
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN team SET DEFAULT ''ce''';
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN team DROP NOT NULL';
  END IF;
END
$$;

-- Keep trigger minimal and resilient; role/team are set by invite-user upsert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    NULLIF(COALESCE(new.raw_user_meta_data->>'full_name', ''), '')
  );
  RETURN new;
END;
$$;
