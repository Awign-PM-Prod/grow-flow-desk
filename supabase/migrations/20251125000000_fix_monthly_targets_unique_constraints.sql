-- Fix unique constraints on monthly_targets table
-- Remove the old constraint that only allowed one target per type per month/year
-- Add new constraints that enforce:
-- 1. Each mandate can have only 1 target per month+year combination (for existing type)
-- 2. Each account+KAM combination can have only 1 target per month+year combination (for new_cross_sell type)

-- Drop the existing unique constraint on (month, year, target_type)
ALTER TABLE public.monthly_targets
DROP CONSTRAINT IF EXISTS monthly_targets_month_year_target_type_key;

-- Create partial unique indexes to enforce the new constraints
-- These indexes only apply when the relevant fields are NOT NULL

-- Unique constraint for existing type: mandate_id + month + year
-- Only applies when mandate_id IS NOT NULL (i.e., for existing type targets)
CREATE UNIQUE INDEX IF NOT EXISTS monthly_targets_mandate_month_year_unique
ON public.monthly_targets (mandate_id, month, year)
WHERE mandate_id IS NOT NULL;

-- Unique constraint for new_cross_sell type: kam_id + account_id + month + year
-- Only applies when both kam_id and account_id are NOT NULL (i.e., for new_cross_sell type targets)
CREATE UNIQUE INDEX IF NOT EXISTS monthly_targets_kam_account_month_year_unique
ON public.monthly_targets (kam_id, account_id, month, year)
WHERE kam_id IS NOT NULL AND account_id IS NOT NULL;

-- Add comments to document the constraints
COMMENT ON INDEX monthly_targets_mandate_month_year_unique IS 
'Ensures each mandate can have only 1 target per month+year combination (for existing type targets)';

COMMENT ON INDEX monthly_targets_kam_account_month_year_unique IS 
'Ensures each account+KAM combination can have only 1 target per month+year combination (for new_cross_sell type targets)';


