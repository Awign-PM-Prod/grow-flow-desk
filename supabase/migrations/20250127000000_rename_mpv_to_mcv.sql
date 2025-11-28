-- Rename mpv to mcv and max_mpv to max_mcv in pipeline_deals table
ALTER TABLE public.pipeline_deals 
  RENAME COLUMN mpv TO mcv;

ALTER TABLE public.pipeline_deals 
  RENAME COLUMN max_mpv TO max_mcv;

