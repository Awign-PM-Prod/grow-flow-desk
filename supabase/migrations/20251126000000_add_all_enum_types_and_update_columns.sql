-- Migration: Add all enum types and update columns to use them
-- This migration creates enum types for all dropdown values and updates existing columns
--
-- Summary:
-- 1. Creates new enum types for: mandate_type, upsell_constraint, upsell_constraint_sub2,
--    retention_type, lob, use_case, sub_use_case, pipeline_status, dropped_reason,
--    contact_level, target_type, mcv_tier, company_size_tier
-- 2. Adds new values to existing upsell_constraint_sub enum
-- 3. Converts existing TEXT/BOOLEAN columns to use appropriate enum types
-- 4. Handles data migration safely with DO blocks and error handling
--
-- Note: upsell_constraint_sub2 remains as TEXT since it can accept free text values

-- ============================================================================
-- PART 1: CREATE NEW ENUM TYPES
-- ============================================================================

-- Mandate Type enum
CREATE TYPE public.mandate_type AS ENUM ('New Acquisition', 'New Cross Sell', 'Existing');

-- Upsell Constraint enum (YES/NO instead of BOOLEAN)
CREATE TYPE public.upsell_constraint AS ENUM ('YES', 'NO');

-- Update upsell_constraint_sub enum to add new values
-- Note: ALTER TYPE ... ADD VALUE cannot be used in a transaction block in older PostgreSQL versions
-- We'll use a DO block to safely add values
DO $$ 
BEGIN
  -- Try to add 'Not enough demand' if it doesn't exist
  BEGIN
    ALTER TYPE public.upsell_constraint_sub ADD VALUE 'Not enough demand';
  EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
  END;
  
  -- Try to add 'Collection Issue' if it doesn't exist
  BEGIN
    ALTER TYPE public.upsell_constraint_sub ADD VALUE 'Collection Issue';
  EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
  END;
END $$;

-- Upsell Constraint Sub 2 enum
CREATE TYPE public.upsell_constraint_sub2 AS ENUM (
  'GM too low',
  'CoC (Cost of Capital too high)',
  'Schedule too tight',
  'Location too remote'
);

-- Retention Type enum
CREATE TYPE public.retention_type AS ENUM ('STAR', 'A', 'B', 'C', 'D', 'E', 'NI');

-- Line of Business (LoB) enum
CREATE TYPE public.lob AS ENUM (
  'Diligence & Audit',
  'New Business Development',
  'Digital Gigs',
  'Awign Expert',
  'Last Mile Operations',
  'Invigilation & Proctoring',
  'Staffing',
  'Others'
);

-- Use Case enum
CREATE TYPE public.use_case AS ENUM (
  'Mystery Audit',
  'Non-Mystery Audit',
  'Background Verification',
  'Promoters Deployment',
  'Fixed Resource Deployment',
  'New Customer Acquisition',
  'Retailer Activation',
  'Society Activation',
  'Content Operations',
  'Telecalling',
  'Market Survey',
  'Edtech',
  'SaaS',
  'Others'
);

-- Sub Use Case enum
CREATE TYPE public.sub_use_case AS ENUM (
  'Stock Audit',
  'Store Audit',
  'Warehouse Audit',
  'Retail Outlet Audit',
  'Distributor Audit',
  'Others'
);

-- Pipeline Status enum
CREATE TYPE public.pipeline_status AS ENUM (
  'Listed',
  'Pre-Appointment Prep Done',
  'Discovery Meeting Done',
  'Requirement Gathering Done',
  'Solution Proposal Made',
  'SOW Handshake Done',
  'Final Proposal Done',
  'Commercial Agreed',
  'Closed Won',
  'Dropped'
);

-- Dropped Reason enum
CREATE TYPE public.dropped_reason AS ENUM (
  'Client Unresponsive',
  'Requirement not feasible',
  'Commercials above Client''s Threshold',
  'Others (put details below)'
);

-- Contact Level enum
CREATE TYPE public.contact_level AS ENUM ('Lv.1', 'Lv.2', 'Lv.3');

-- Target Type enum
CREATE TYPE public.target_type AS ENUM ('new_cross_sell', 'existing');

-- MCV Tier enum
CREATE TYPE public.mcv_tier AS ENUM ('Tier 1', 'Tier 2');

-- Company Size Tier enum
CREATE TYPE public.company_size_tier AS ENUM ('Tier 1', 'Tier 2');

-- ============================================================================
-- PART 2: UPDATE EXISTING COLUMNS TO USE ENUM TYPES
-- ============================================================================

-- Add type column to mandates if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.mandates ADD COLUMN type TEXT;
  END IF;
END $$;

-- Update mandates table columns
-- Convert upsell_constraint from BOOLEAN to enum
-- First, change the column type to TEXT temporarily if needed
DO $$
BEGIN
  -- Check if column is BOOLEAN type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'upsell_constraint'
    AND data_type = 'boolean'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN upsell_constraint TYPE TEXT
      USING CASE 
        WHEN upsell_constraint = true THEN 'YES'
        WHEN upsell_constraint = false THEN 'NO'
        ELSE NULL
      END;
  END IF;
END $$;

-- Now convert to enum
ALTER TABLE public.mandates
  ALTER COLUMN upsell_constraint TYPE public.upsell_constraint
  USING upsell_constraint::public.upsell_constraint;

-- Update type column to use enum (only if column exists and has data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN type TYPE public.mandate_type
      USING type::public.mandate_type;
  END IF;
END $$;

-- Update retention_type to use enum (only if column has valid data)
DO $$
BEGIN
  -- Only convert if all values are valid enum values
  IF NOT EXISTS (
    SELECT 1 FROM public.mandates 
    WHERE retention_type IS NOT NULL 
    AND retention_type NOT IN ('STAR', 'A', 'B', 'C', 'D', 'E', 'NI')
  ) THEN
    ALTER TABLE public.mandates
      ALTER COLUMN retention_type TYPE public.retention_type
      USING retention_type::public.retention_type;
  END IF;
END $$;

-- Update lob to use enum
-- First, check for any invalid values and set them to NULL if needed
DO $$
DECLARE
  invalid_lob_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_lob_count
  FROM public.mandates
  WHERE lob IS NOT NULL
  AND lob NOT IN (
    'Diligence & Audit',
    'New Business Development',
    'Digital Gigs',
    'Awign Expert',
    'Last Mile Operations',
    'Invigilation & Proctoring',
    'Staffing',
    'Others'
  );
  
  IF invalid_lob_count > 0 THEN
    -- Set invalid values to NULL
    UPDATE public.mandates
    SET lob = NULL
    WHERE lob IS NOT NULL
    AND lob NOT IN (
      'Diligence & Audit',
      'New Business Development',
      'Digital Gigs',
      'Awign Expert',
      'Last Mile Operations',
      'Invigilation & Proctoring',
      'Staffing',
      'Others'
    );
  END IF;
END $$;

ALTER TABLE public.mandates
  ALTER COLUMN lob TYPE public.lob
  USING lob::public.lob;

-- Update use_case to use enum (nullable, so safe to convert)
-- First, clean up any invalid values (including "-") by setting them to NULL
DO $$
DECLARE
  invalid_use_case_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'use_case'
  ) THEN
    -- Count invalid values
    SELECT COUNT(*) INTO invalid_use_case_count
    FROM public.mandates
    WHERE use_case IS NOT NULL
    AND use_case NOT IN (
      'Mystery Audit',
      'Non-Mystery Audit',
      'Background Verification',
      'Promoters Deployment',
      'Fixed Resource Deployment',
      'New Customer Acquisition',
      'Retailer Activation',
      'Society Activation',
      'Content Operations',
      'Telecalling',
      'Market Survey',
      'Edtech',
      'SaaS',
      'Others'
    );
    
    -- Set invalid values (including "-") to NULL before converting
    IF invalid_use_case_count > 0 THEN
      UPDATE public.mandates
      SET use_case = NULL
      WHERE use_case IS NOT NULL
      AND use_case NOT IN (
        'Mystery Audit',
        'Non-Mystery Audit',
        'Background Verification',
        'Promoters Deployment',
        'Fixed Resource Deployment',
        'New Customer Acquisition',
        'Retailer Activation',
        'Society Activation',
        'Content Operations',
        'Telecalling',
        'Market Survey',
        'Edtech',
        'SaaS',
        'Others'
      );
    END IF;
    
    -- Now convert to enum
    ALTER TABLE public.mandates
      ALTER COLUMN use_case TYPE public.use_case
      USING use_case::public.use_case;
  END IF;
END $$;

-- Update sub_use_case to use enum (nullable, so safe to convert)
-- First, clean up any invalid values (including "-") by setting them to NULL
DO $$
DECLARE
  invalid_sub_use_case_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'mandates' 
    AND column_name = 'sub_use_case'
  ) THEN
    -- Count invalid values
    SELECT COUNT(*) INTO invalid_sub_use_case_count
    FROM public.mandates
    WHERE sub_use_case IS NOT NULL
    AND sub_use_case NOT IN (
      'Stock Audit',
      'Store Audit',
      'Warehouse Audit',
      'Retail Outlet Audit',
      'Distributor Audit',
      'Others'
    );
    
    -- Set invalid values (including "-") to NULL before converting
    IF invalid_sub_use_case_count > 0 THEN
      UPDATE public.mandates
      SET sub_use_case = NULL
      WHERE sub_use_case IS NOT NULL
      AND sub_use_case NOT IN (
        'Stock Audit',
        'Store Audit',
        'Warehouse Audit',
        'Retail Outlet Audit',
        'Distributor Audit',
        'Others'
      );
    END IF;
    
    -- Now convert to enum
    ALTER TABLE public.mandates
      ALTER COLUMN sub_use_case TYPE public.sub_use_case
      USING sub_use_case::public.sub_use_case;
  END IF;
END $$;

-- Update upsell_constraint_sub2 to use enum (nullable, can be free text for "Others")
-- Note: This column can also accept free text, so we'll keep it as TEXT but add a CHECK constraint
-- Actually, since it can be free text, we should leave it as TEXT but add validation
-- For now, we'll add a CHECK constraint that allows enum values OR any text
ALTER TABLE public.mandates
  ALTER COLUMN upsell_constraint_sub2 TYPE TEXT; -- Keep as TEXT since it can be free text

-- Add CHECK constraint for upsell_constraint_sub2 to allow enum values or any text
-- (We'll validate in application layer for free text)

-- Update pipeline_deals table columns
-- Update status to use enum
-- First, drop the default constraint, convert type, then restore default
ALTER TABLE public.pipeline_deals
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.pipeline_deals
  ALTER COLUMN status TYPE public.pipeline_status
  USING status::public.pipeline_status;

-- Restore the default value with the enum type
ALTER TABLE public.pipeline_deals
  ALTER COLUMN status SET DEFAULT 'Listed'::public.pipeline_status;

-- Update dropped_reason to use enum (nullable, so safe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_deals' 
    AND column_name = 'dropped_reason'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ALTER COLUMN dropped_reason TYPE public.dropped_reason
      USING dropped_reason::public.dropped_reason;
  END IF;
END $$;

-- Update lob to use enum
-- First, check for any invalid values and set them to NULL if needed
DO $$
DECLARE
  invalid_lob_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_lob_count
  FROM public.pipeline_deals
  WHERE lob IS NOT NULL
  AND lob NOT IN (
    'Diligence & Audit',
    'New Business Development',
    'Digital Gigs',
    'Awign Expert',
    'Last Mile Operations',
    'Invigilation & Proctoring',
    'Staffing',
    'Others'
  );
  
  IF invalid_lob_count > 0 THEN
    -- Set invalid values to NULL
    UPDATE public.pipeline_deals
    SET lob = NULL
    WHERE lob IS NOT NULL
    AND lob NOT IN (
      'Diligence & Audit',
      'New Business Development',
      'Digital Gigs',
      'Awign Expert',
      'Last Mile Operations',
      'Invigilation & Proctoring',
      'Staffing',
      'Others'
    );
  END IF;
END $$;

ALTER TABLE public.pipeline_deals
  ALTER COLUMN lob TYPE public.lob
  USING lob::public.lob;

-- Update use_case to use enum
-- Set invalid values (including "-") to a valid default ('Others') to maintain NOT NULL constraint
DO $$
DECLARE
  invalid_use_case_count INTEGER;
BEGIN
  -- Count invalid values
  SELECT COUNT(*) INTO invalid_use_case_count
  FROM public.pipeline_deals
  WHERE use_case IS NOT NULL
  AND use_case NOT IN (
    'Mystery Audit',
    'Non-Mystery Audit',
    'Background Verification',
    'Promoters Deployment',
    'Fixed Resource Deployment',
    'New Customer Acquisition',
    'Retailer Activation',
    'Society Activation',
    'Content Operations',
    'Telecalling',
    'Market Survey',
    'Edtech',
    'SaaS',
    'Others'
  );
  
  -- Set invalid values (including "-") to 'Others' as default to maintain NOT NULL constraint
  IF invalid_use_case_count > 0 THEN
    UPDATE public.pipeline_deals
    SET use_case = 'Others'
    WHERE use_case IS NOT NULL
    AND use_case NOT IN (
      'Mystery Audit',
      'Non-Mystery Audit',
      'Background Verification',
      'Promoters Deployment',
      'Fixed Resource Deployment',
      'New Customer Acquisition',
      'Retailer Activation',
      'Society Activation',
      'Content Operations',
      'Telecalling',
      'Market Survey',
      'Edtech',
      'SaaS',
      'Others'
    );
  END IF;
END $$;

-- Convert to enum
ALTER TABLE public.pipeline_deals
  ALTER COLUMN use_case TYPE public.use_case
  USING use_case::public.use_case;

-- Update sub_use_case to use enum
-- Set invalid values (including "-") to a valid default ('Others') to maintain NOT NULL constraint
DO $$
DECLARE
  invalid_sub_use_case_count INTEGER;
BEGIN
  -- Count invalid values
  SELECT COUNT(*) INTO invalid_sub_use_case_count
  FROM public.pipeline_deals
  WHERE sub_use_case IS NOT NULL
  AND sub_use_case NOT IN (
    'Stock Audit',
    'Store Audit',
    'Warehouse Audit',
    'Retail Outlet Audit',
    'Distributor Audit',
    'Others'
  );
  
  -- Set invalid values (including "-") to 'Others' as default to maintain NOT NULL constraint
  IF invalid_sub_use_case_count > 0 THEN
    UPDATE public.pipeline_deals
    SET sub_use_case = 'Others'
    WHERE sub_use_case IS NOT NULL
    AND sub_use_case NOT IN (
      'Stock Audit',
      'Store Audit',
      'Warehouse Audit',
      'Retail Outlet Audit',
      'Distributor Audit',
      'Others'
    );
  END IF;
END $$;

-- Convert to enum
ALTER TABLE public.pipeline_deals
  ALTER COLUMN sub_use_case TYPE public.sub_use_case
  USING sub_use_case::public.sub_use_case;

-- Update prj_frequency to use existing prj_type enum
-- Remove existing CHECK constraint first
ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_prj_frequency_check;

-- Convert 'One-Time' to 'One-time' to match enum value
UPDATE public.pipeline_deals
SET prj_frequency = 'One-time'
WHERE prj_frequency = 'One-Time';

-- Now convert to enum
ALTER TABLE public.pipeline_deals
  ALTER COLUMN prj_frequency TYPE public.prj_type
  USING prj_frequency::public.prj_type;

-- Update contacts table columns
-- Remove existing CHECK constraint and use enum instead
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_level_check;

ALTER TABLE public.contacts
  ALTER COLUMN level TYPE public.contact_level
  USING level::public.contact_level;

-- Update monthly_targets table columns
-- Remove existing CHECK constraint and use enum instead
ALTER TABLE public.monthly_targets
  DROP CONSTRAINT IF EXISTS monthly_targets_target_type_check;

ALTER TABLE public.monthly_targets
  ALTER COLUMN target_type TYPE public.target_type
  USING target_type::public.target_type;

-- Update accounts table columns
-- Update mcv_tier to use enum (nullable, so safe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'mcv_tier'
  ) THEN
    ALTER TABLE public.accounts
      ALTER COLUMN mcv_tier TYPE public.mcv_tier
      USING mcv_tier::public.mcv_tier;
  END IF;
END $$;

-- Update company_size_tier to use enum (nullable, so safe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'company_size_tier'
  ) THEN
    ALTER TABLE public.accounts
      ALTER COLUMN company_size_tier TYPE public.company_size_tier
      USING company_size_tier::public.company_size_tier;
  END IF;
END $$;

-- ============================================================================
-- PART 3: UPDATE INDEXES (if needed)
-- ============================================================================

-- Indexes are already created, but we may want to ensure they exist
-- Most indexes should still work with enum types

-- ============================================================================
-- PART 4: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TYPE public.mandate_type IS 'Type of mandate: New Acquisition, New Cross Sell, or Existing';
COMMENT ON TYPE public.upsell_constraint IS 'Whether there is an upsell constraint: YES or NO';
COMMENT ON TYPE public.upsell_constraint_sub2 IS 'Specific upsell constraint sub-category details';
COMMENT ON TYPE public.retention_type IS 'Retention type classification: STAR, A, B, C, D, E, or NI';
COMMENT ON TYPE public.lob IS 'Line of Business vertical';
COMMENT ON TYPE public.use_case IS 'Use case within a line of business';
COMMENT ON TYPE public.sub_use_case IS 'Sub-use case within a use case';
COMMENT ON TYPE public.pipeline_status IS 'Status of a pipeline deal';
COMMENT ON TYPE public.dropped_reason IS 'Reason for dropping a pipeline deal';
COMMENT ON TYPE public.contact_level IS 'Contact hierarchy level: Lv.1, Lv.2, or Lv.3';
COMMENT ON TYPE public.target_type IS 'Type of target: new_cross_sell or existing';
COMMENT ON TYPE public.mcv_tier IS 'MCV tier classification: Tier 1 or Tier 2';
COMMENT ON TYPE public.company_size_tier IS 'Company size tier classification: Tier 1 or Tier 2';

