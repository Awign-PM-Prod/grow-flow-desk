-- Remove planned MCV from monthly_data column
-- This migration converts the old format [plannedMcv, achievedMcv] to the new format: just achievedMcv (number)
-- It preserves all achieved MCV values while removing planned MCV values

DO $$
DECLARE
  mandate_record RECORD;
  updated_monthly_data JSONB;
  month_key TEXT;
  month_value JSONB;
  achieved_mcv NUMERIC;
BEGIN
  -- Loop through all mandates that have monthly_data
  FOR mandate_record IN 
    SELECT id, monthly_data 
    FROM public.mandates 
    WHERE monthly_data IS NOT NULL
  LOOP
    updated_monthly_data := '{}'::JSONB;
    
    -- Process each month entry in monthly_data
    FOR month_key, month_value IN 
      SELECT * FROM jsonb_each(mandate_record.monthly_data)
    LOOP
      -- Check if the value is an array (old format)
      IF jsonb_typeof(month_value) = 'array' AND jsonb_array_length(month_value) >= 2 THEN
        -- Extract achieved MCV (index 1) from old format [plannedMcv, achievedMcv]
        achieved_mcv := (month_value->>1)::NUMERIC;
        
        -- Store only achieved MCV (new format: just the number)
        updated_monthly_data := updated_monthly_data || jsonb_build_object(month_key, achieved_mcv);
      ELSIF jsonb_typeof(month_value) = 'number' THEN
        -- Already in new format, keep as is
        updated_monthly_data := updated_monthly_data || jsonb_build_object(month_key, month_value);
      ELSE
        -- Unknown format, skip or keep as is
        updated_monthly_data := updated_monthly_data || jsonb_build_object(month_key, month_value);
      END IF;
    END LOOP;
    
    -- Update the mandate with cleaned monthly_data
    UPDATE public.mandates
    SET monthly_data = updated_monthly_data
    WHERE id = mandate_record.id;
    
  END LOOP;
END $$;

-- Add comment to document the change
COMMENT ON COLUMN public.mandates.monthly_data IS 'JSONB object storing monthly achieved MCV. Format: {"YYYY-MM": achievedMcv_number}. Old format [plannedMcv, achievedMcv] has been migrated to store only achievedMcv.';















