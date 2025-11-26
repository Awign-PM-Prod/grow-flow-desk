-- Update unique constraint on monthly_targets to include target_type
-- This allows up to 2 targets per month/year combination:
-- 1 with target_type = 'existing' and 1 with target_type = 'new_cross_sell'

-- First, ensure target_type is NOT NULL for all existing records
-- Set a default value for any NULL target_type records (if any exist)
UPDATE public.monthly_targets
SET target_type = 'existing'
WHERE target_type IS NULL;

-- Make target_type NOT NULL
ALTER TABLE public.monthly_targets
ALTER COLUMN target_type SET NOT NULL;

-- Drop the existing unique constraint on (month, year)
ALTER TABLE public.monthly_targets
DROP CONSTRAINT IF EXISTS monthly_targets_month_year_key;

-- Add new unique constraint that includes target_type
-- This allows one target of each type per month/year combination
ALTER TABLE public.monthly_targets
ADD CONSTRAINT monthly_targets_month_year_target_type_key UNIQUE (month, year, target_type);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT monthly_targets_month_year_target_type_key ON public.monthly_targets IS 
'Ensures unique target per month/year/target_type combination. Allows up to 2 targets per month/year: one existing and one new_cross_sell';

