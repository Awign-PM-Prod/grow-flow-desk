-- Backfill kam_id and nso_mail_id for existing monthly_targets
-- This updates existing targets to have KAM and NSO information derived from their mandates

-- Update kam_id for existing targets that have a mandate_id
-- Get kam_id from the mandate
UPDATE public.monthly_targets
SET kam_id = (
  SELECT kam_id
  FROM public.mandates
  WHERE mandates.id = monthly_targets.mandate_id
)
WHERE mandate_id IS NOT NULL
  AND kam_id IS NULL;

-- Update nso_mail_id for existing targets that have a mandate_id
-- Only for mandates with type = 'New Acquisition' and new_sales_owner is not null
-- IMPORTANT: Only set nso_mail_id if the value exists in new_sales_officers table
-- This prevents foreign key constraint violations for old data that might have names instead of mail_ids
UPDATE public.monthly_targets
SET nso_mail_id = (
  SELECT mandates.new_sales_owner
  FROM public.mandates
  WHERE mandates.id = monthly_targets.mandate_id
    AND mandates.type = 'New Acquisition'
    AND mandates.new_sales_owner IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.new_sales_officers
      WHERE new_sales_officers.mail_id = mandates.new_sales_owner
    )
)
WHERE mandate_id IS NOT NULL
  AND nso_mail_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.mandates
    WHERE mandates.id = monthly_targets.mandate_id
      AND mandates.type = 'New Acquisition'
      AND mandates.new_sales_owner IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.new_sales_officers
        WHERE new_sales_officers.mail_id = mandates.new_sales_owner
      )
  );

-- Add comment to document the backfill
COMMENT ON COLUMN public.monthly_targets.kam_id IS 'Reference to the Key Account Manager (KAM) assigned to this target. For existing targets, derived from the mandate. For new cross sell targets, linked through mandates.';
COMMENT ON COLUMN public.monthly_targets.nso_mail_id IS 'NSO Mail ID derived from the linked mandate (only for New Acquisition mandates). Backfilled from mandate.new_sales_owner for existing targets.';

