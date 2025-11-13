-- Add monthly_data column to mandates table
-- This column stores a JSONB dictionary where:
--   - Key: month_year (format: "YYYY-MM", e.g., "2025-01")
--   - Value: Array of length 2

ALTER TABLE public.mandates
ADD COLUMN IF NOT EXISTS monthly_data JSONB;

