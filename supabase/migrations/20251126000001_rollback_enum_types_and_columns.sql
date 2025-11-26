-- Rollback Migration: Undo all changes from 20251126000000_add_all_enum_types_and_update_columns.sql
-- This migration reverts all enum types and column type changes

-- ============================================================================
-- PART 1: REVERT COLUMN TYPES BACK TO ORIGINAL
-- ============================================================================

-- Revert mandates table columns
-- Revert type column back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'type'
    AND udt_name = 'mandate_type'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN type TYPE TEXT
      USING type::TEXT;
  END IF;
END $$;

-- Revert upsell_constraint from enum back to BOOLEAN
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'upsell_constraint'
    AND udt_name = 'upsell_constraint'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN upsell_constraint TYPE BOOLEAN
      USING CASE 
        WHEN upsell_constraint::TEXT = 'YES' THEN true
        WHEN upsell_constraint::TEXT = 'NO' THEN false
        ELSE NULL
      END;
  END IF;
END $$;

-- Revert retention_type back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'retention_type'
    AND udt_name = 'retention_type'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN retention_type TYPE TEXT
      USING retention_type::TEXT;
  END IF;
END $$;

-- Revert lob back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'lob'
    AND udt_name = 'lob'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN lob TYPE TEXT
      USING lob::TEXT;
  END IF;
END $$;

-- Revert use_case back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'use_case'
    AND udt_name = 'use_case'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN use_case TYPE TEXT
      USING use_case::TEXT;
  END IF;
END $$;

-- Revert sub_use_case back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'sub_use_case'
    AND udt_name = 'sub_use_case'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN sub_use_case TYPE TEXT
      USING sub_use_case::TEXT;
  END IF;
END $$;

-- Revert pipeline_deals table columns
-- Revert status back to TEXT and restore original default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_deals' 
    AND column_name = 'status'
    AND udt_name = 'pipeline_status'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN status DROP DEFAULT;
    
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN status TYPE TEXT
      USING status::TEXT;
    
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN status SET DEFAULT 'Listed';
  END IF;
END $$;

-- Revert dropped_reason back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_deals' 
    AND column_name = 'dropped_reason'
    AND udt_name = 'dropped_reason'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN dropped_reason TYPE TEXT
      USING dropped_reason::TEXT;
  END IF;
END $$;

-- Revert lob back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_deals' 
    AND column_name = 'lob'
    AND udt_name = 'lob'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN lob TYPE TEXT
      USING lob::TEXT;
  END IF;
END $$;

-- Revert use_case back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_deals' 
    AND column_name = 'use_case'
    AND udt_name = 'use_case'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN use_case TYPE TEXT
      USING use_case::TEXT;
  END IF;
END $$;

-- Revert sub_use_case back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_deals' 
    AND column_name = 'sub_use_case'
    AND udt_name = 'sub_use_case'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN sub_use_case TYPE TEXT
      USING sub_use_case::TEXT;
  END IF;
END $$;

-- Revert prj_frequency back to TEXT and restore CHECK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_deals' 
    AND column_name = 'prj_frequency'
    AND udt_name = 'prj_type'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN prj_frequency TYPE TEXT
      USING prj_frequency::TEXT;
    
    -- Restore CHECK constraint
    ALTER TABLE public.pipeline_deals
      ADD CONSTRAINT pipeline_deals_prj_frequency_check 
      CHECK (prj_frequency IN ('One-Time', 'Recurring'));
  END IF;
END $$;

-- Revert contacts table columns
-- Revert level back to TEXT and restore CHECK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts' 
    AND column_name = 'level'
    AND udt_name = 'contact_level'
  ) THEN
    ALTER TABLE public.contacts
      ALTER COLUMN level TYPE TEXT
      USING level::TEXT;
    
    -- Restore CHECK constraint
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_level_check 
      CHECK (level IN ('Lv.1', 'Lv.2', 'Lv.3'));
  END IF;
END $$;

-- Revert monthly_targets table columns
-- Revert target_type back to TEXT and restore CHECK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'monthly_targets' 
    AND column_name = 'target_type'
    AND udt_name = 'target_type'
  ) THEN
    ALTER TABLE public.monthly_targets
      ALTER COLUMN target_type TYPE TEXT
      USING target_type::TEXT;
    
    -- Restore CHECK constraint
    ALTER TABLE public.monthly_targets
      ADD CONSTRAINT monthly_targets_target_type_check 
      CHECK (target_type IN ('new_cross_sell', 'existing'));
  END IF;
END $$;

-- Revert accounts table columns
-- Revert mcv_tier back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'mcv_tier'
    AND udt_name = 'mcv_tier'
  ) THEN
    ALTER TABLE public.accounts
      ALTER COLUMN mcv_tier TYPE TEXT
      USING mcv_tier::TEXT;
  END IF;
END $$;

-- Revert company_size_tier back to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'company_size_tier'
    AND udt_name = 'company_size_tier'
  ) THEN
    ALTER TABLE public.accounts
      ALTER COLUMN company_size_tier TYPE TEXT
      USING company_size_tier::TEXT;
  END IF;
END $$;

-- ============================================================================
-- PART 2: DROP ALL NEW ENUM TYPES
-- ============================================================================

-- Drop enum types (in reverse order to avoid dependency issues)
DROP TYPE IF EXISTS public.company_size_tier CASCADE;
DROP TYPE IF EXISTS public.mcv_tier CASCADE;
DROP TYPE IF EXISTS public.target_type CASCADE;
DROP TYPE IF EXISTS public.contact_level CASCADE;
DROP TYPE IF EXISTS public.dropped_reason CASCADE;
DROP TYPE IF EXISTS public.pipeline_status CASCADE;
DROP TYPE IF EXISTS public.sub_use_case CASCADE;
DROP TYPE IF EXISTS public.use_case CASCADE;
DROP TYPE IF EXISTS public.lob CASCADE;
DROP TYPE IF EXISTS public.retention_type CASCADE;
DROP TYPE IF EXISTS public.upsell_constraint_sub2 CASCADE;
DROP TYPE IF EXISTS public.upsell_constraint CASCADE;
DROP TYPE IF EXISTS public.mandate_type CASCADE;

-- Note: We don't drop upsell_constraint_sub enum because it existed before
-- and we only added values to it. The added values will remain but won't cause issues.

-- ============================================================================
-- PART 3: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.mandates IS 'Rollback completed - all enum types reverted to TEXT/BOOLEAN';
COMMENT ON TABLE public.pipeline_deals IS 'Rollback completed - all enum types reverted to TEXT';
COMMENT ON TABLE public.contacts IS 'Rollback completed - level enum reverted to TEXT with CHECK constraint';
COMMENT ON TABLE public.monthly_targets IS 'Rollback completed - target_type enum reverted to TEXT with CHECK constraint';
COMMENT ON TABLE public.accounts IS 'Rollback completed - tier enums reverted to TEXT';

