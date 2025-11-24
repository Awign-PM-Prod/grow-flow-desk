-- Add KAM column to monthly_targets table
-- This column will store the UUID of the Key Account Manager (KAM)

-- Add the kam_id column (nullable to allow existing records without a KAM)
ALTER TABLE public.monthly_targets
ADD COLUMN kam_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add an index for better query performance when filtering by KAM
CREATE INDEX idx_monthly_targets_kam_id ON public.monthly_targets(kam_id);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN public.monthly_targets.kam_id IS 'Reference to the Key Account Manager (KAM) assigned to this target';


