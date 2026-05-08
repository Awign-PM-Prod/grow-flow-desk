-- Add team scoping to manager_targets so each team can maintain independent targets.
ALTER TABLE public.manager_targets
ADD COLUMN IF NOT EXISTS team TEXT;

UPDATE public.manager_targets
SET team = 'ce'
WHERE team IS NULL OR btrim(team::text) = '';

ALTER TABLE public.manager_targets
ALTER COLUMN team SET NOT NULL;

ALTER TABLE public.manager_targets
DROP CONSTRAINT IF EXISTS manager_targets_team_check;

ALTER TABLE public.manager_targets
ADD CONSTRAINT manager_targets_team_check
CHECK (team IN ('ce', 'staffing', 'experts'));

ALTER TABLE public.manager_targets
DROP CONSTRAINT IF EXISTS manager_targets_month_year_key;

ALTER TABLE public.manager_targets
ADD CONSTRAINT manager_targets_month_year_team_key UNIQUE (month, year, team);

CREATE INDEX IF NOT EXISTS idx_manager_targets_team ON public.manager_targets(team);
