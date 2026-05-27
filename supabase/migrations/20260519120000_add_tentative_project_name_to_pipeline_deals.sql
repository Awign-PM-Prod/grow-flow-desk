-- Add optional tentative project name to pipeline deals
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS tentative_project_name TEXT;

COMMENT ON COLUMN public.pipeline_deals.tentative_project_name IS 'User-defined tentative project name; editable independently of sales module name';
