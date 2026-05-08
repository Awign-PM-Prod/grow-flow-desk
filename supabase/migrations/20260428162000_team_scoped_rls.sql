-- Enforce team-scoped reads across mandates and manager targets.

-- Make this migration resilient even if run before the manager_targets team migration.
ALTER TABLE public.manager_targets
ADD COLUMN IF NOT EXISTS team public.team;

UPDATE public.manager_targets
SET team = 'ce'::public.team
WHERE team IS NULL;

-- Avoid policy recursion by reading current user's team via SECURITY DEFINER
-- instead of inline subqueries against public.profiles inside policy expressions.
CREATE OR REPLACE FUNCTION public.auth_profile_team()
RETURNS public.team
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.team
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

DROP POLICY IF EXISTS "Users can view their own mandates or all if KAM/Manager" ON public.mandates;
CREATE POLICY "Users can view their own mandates or all if KAM/Manager"
  ON public.mandates FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      mandates.team IS NOT NULL
      AND mandates.team = public.auth_profile_team()
      AND (
        created_by = auth.uid()
        OR kam_id = auth.uid()
        OR public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'leadership'::app_role)
        OR public.is_nso_scoped_mandate(new_sales_owner, type)
      )
    )
  );

DROP POLICY IF EXISTS "Managers and above can view manager_targets" ON public.manager_targets;
CREATE POLICY "Managers and above can view manager_targets"
  ON public.manager_targets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      manager_targets.team IS NOT NULL
      AND manager_targets.team = public.auth_profile_team()
      AND (
        public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'leadership'::app_role)
        OR public.has_role(auth.uid(), 'nso'::app_role)
      )
    )
  );
