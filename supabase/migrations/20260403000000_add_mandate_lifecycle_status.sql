-- Active / Inactive: inactive mandates must not contribute targets in reporting.
DO $$ BEGIN
  CREATE TYPE public.mandate_lifecycle_status AS ENUM ('Active', 'Inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.mandate_lifecycle_status IS 'Mandate active/inactive for target rollups.';

DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mandates'
      AND column_name = 'lifecycle_status'
  ) THEN
    ALTER TABLE public.mandates
      ADD COLUMN lifecycle_status public.mandate_lifecycle_status NOT NULL DEFAULT 'Active';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mandates'
      AND column_name = 'lifecycle_status'
      AND udt_name = 'text'
  ) THEN
    -- Remove TEXT+CHECK from an earlier migration before casting to enum.
    FOR r IN (
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'mandates'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%lifecycle_status%'
    ) LOOP
      EXECUTE format('ALTER TABLE public.mandates DROP CONSTRAINT %I', r.conname);
    END LOOP;
    ALTER TABLE public.mandates
      ALTER COLUMN lifecycle_status DROP DEFAULT;
    ALTER TABLE public.mandates
      ALTER COLUMN lifecycle_status TYPE public.mandate_lifecycle_status
      USING (lifecycle_status::public.mandate_lifecycle_status);
    ALTER TABLE public.mandates
      ALTER COLUMN lifecycle_status SET DEFAULT 'Active';
    ALTER TABLE public.mandates
      ALTER COLUMN lifecycle_status SET NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.mandates.lifecycle_status IS 'Active: mandate counts toward targets. Inactive: monthly_targets for this mandate are ignored in dashboards.';

CREATE INDEX IF NOT EXISTS idx_mandates_lifecycle_status ON public.mandates (lifecycle_status);

-- Managers can update mandates (toggle lifecycle) alongside existing roles.
DROP POLICY IF EXISTS "KAMs can update their mandates" ON public.mandates;
CREATE POLICY "KAMs can update their mandates"
  ON public.mandates FOR UPDATE
  USING (
    public.can_mutate_portal_data(auth.uid())
    AND (
      kam_id = auth.uid()
      OR created_by = auth.uid()
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );
