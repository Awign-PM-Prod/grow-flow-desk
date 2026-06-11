-- Staffing mandates use use_case / sub_use_case values that were missing from the DB enums.

ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Staffing';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Staffing - Core';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Retail Branding';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Loyalty Programs';

ALTER TYPE public.sub_use_case ADD VALUE IF NOT EXISTS 'Merchandiser Driven Programs';
ALTER TYPE public.sub_use_case ADD VALUE IF NOT EXISTS 'Signage Deployments';
ALTER TYPE public.sub_use_case ADD VALUE IF NOT EXISTS 'Onetime POS and deployment';
