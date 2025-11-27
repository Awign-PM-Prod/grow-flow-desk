-- Add target type, account_id, and mandate_id columns to monthly_targets table
-- This allows targets to be associated with either an account (for new cross sell targets) or a mandate (for existing targets)

-- Add target_type column
ALTER TABLE public.monthly_targets
ADD COLUMN target_type TEXT CHECK (target_type IN ('new_cross_sell', 'existing'));

-- Add account_id column (nullable, for new cross sell targets)
ALTER TABLE public.monthly_targets
ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add mandate_id column (nullable, for existing targets)
ALTER TABLE public.monthly_targets
ADD COLUMN mandate_id UUID REFERENCES public.mandates(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX idx_monthly_targets_target_type ON public.monthly_targets(target_type);
CREATE INDEX idx_monthly_targets_account_id ON public.monthly_targets(account_id);
CREATE INDEX idx_monthly_targets_mandate_id ON public.monthly_targets(mandate_id);

-- Add comments to document the columns
COMMENT ON COLUMN public.monthly_targets.target_type IS 'Type of target: new_cross_sell (for accounts) or existing (for mandates)';
COMMENT ON COLUMN public.monthly_targets.account_id IS 'Reference to account for new cross sell targets';
COMMENT ON COLUMN public.monthly_targets.mandate_id IS 'Reference to mandate for existing targets';











