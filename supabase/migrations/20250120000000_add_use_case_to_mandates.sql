-- Add use_case and sub_use_case columns to mandates table
ALTER TABLE public.mandates
ADD COLUMN IF NOT EXISTS use_case TEXT,
ADD COLUMN IF NOT EXISTS sub_use_case TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mandates_use_case ON public.mandates(use_case);
CREATE INDEX IF NOT EXISTS idx_mandates_sub_use_case ON public.mandates(sub_use_case);

