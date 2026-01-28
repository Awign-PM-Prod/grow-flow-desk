-- Add NSO mail id column to monthly_targets table
-- This lets us attribute targets to the NSO linked to the mandate (for New Acquisition mandates)

ALTER TABLE public.monthly_targets
ADD COLUMN IF NOT EXISTS nso_mail_id TEXT;

-- Optional FK to ensure the value corresponds to an existing NSO mail_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'monthly_targets'
      AND constraint_name = 'monthly_targets_nso_mail_id_fkey'
  ) THEN
    ALTER TABLE public.monthly_targets
      ADD CONSTRAINT monthly_targets_nso_mail_id_fkey
      FOREIGN KEY (nso_mail_id)
      REFERENCES public.new_sales_officers(mail_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monthly_targets_nso_mail_id ON public.monthly_targets(nso_mail_id);

COMMENT ON COLUMN public.monthly_targets.nso_mail_id IS 'NSO Mail ID derived from the linked mandate (only for New Acquisition mandates).';


