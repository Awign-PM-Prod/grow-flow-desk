-- Add handover_date column to mandates table
-- This is an optional field for storing the handover date in the handover info section

ALTER TABLE public.mandates
ADD COLUMN handover_date DATE;

COMMENT ON COLUMN public.mandates.handover_date IS 'Optional handover date for mandates (only applicable for New Acquisition and Existing types)';

















