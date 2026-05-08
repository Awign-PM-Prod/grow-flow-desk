-- Make auth signup trigger resilient to profiles schema drift.
-- This prevents auth.admin.createUser() from failing with
-- "Database error creating new user" when profiles has extra columns
-- like role/team.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_role_column BOOLEAN;
  has_team_column BOOLEAN;
  metadata_role TEXT;
  metadata_team TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) INTO has_role_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'team'
  ) INTO has_team_column;

  metadata_role := NULLIF(new.raw_user_meta_data->>'role', '');
  metadata_team := NULLIF(new.raw_user_meta_data->>'team', '');

  IF has_role_column AND has_team_column THEN
    INSERT INTO public.profiles (id, email, full_name, role, team)
    VALUES (
      new.id,
      new.email,
      NULLIF(COALESCE(new.raw_user_meta_data->>'full_name', ''), ''),
      CASE
        WHEN metadata_role IN ('kam', 'manager', 'leadership', 'superadmin', 'nso')
          THEN metadata_role::public.app_role
        ELSE 'kam'::public.app_role
      END,
      metadata_team
    );
  ELSIF has_role_column THEN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      new.id,
      new.email,
      NULLIF(COALESCE(new.raw_user_meta_data->>'full_name', ''), ''),
      CASE
        WHEN metadata_role IN ('kam', 'manager', 'leadership', 'superadmin', 'nso')
          THEN metadata_role::public.app_role
        ELSE 'kam'::public.app_role
      END
    );
  ELSIF has_team_column THEN
    INSERT INTO public.profiles (id, email, full_name, team)
    VALUES (
      new.id,
      new.email,
      NULLIF(COALESCE(new.raw_user_meta_data->>'full_name', ''), ''),
      metadata_team
    );
  ELSE
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      new.id,
      new.email,
      NULLIF(COALESCE(new.raw_user_meta_data->>'full_name', ''), '')
    );
  END IF;

  RETURN new;
END;
$$;
