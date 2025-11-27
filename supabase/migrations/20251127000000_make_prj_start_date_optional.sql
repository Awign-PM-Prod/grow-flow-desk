-- Make prj_start_date optional in pipeline_deals table
ALTER TABLE public.pipeline_deals 
ALTER COLUMN prj_start_date DROP NOT NULL;

