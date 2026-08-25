-- Leadership is org-wide and read-only: no team on the profile, SELECT across all teams.
-- Writes stay blocked by can_mutate_portal_data (leadership is not included).

UPDATE public.profiles
SET team = NULL
WHERE role = 'leadership'::public.app_role
  AND team IS NOT NULL;

DROP POLICY IF EXISTS "Users can view their own mandates or all if KAM/Manager" ON public.mandates;
CREATE POLICY "Users can view their own mandates or all if KAM/Manager"
  ON public.mandates FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR (
      mandates.team IS NOT NULL
      AND mandates.team = public.auth_profile_team()
      AND (
        created_by = auth.uid()
        OR kam_id = auth.uid()
        OR public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'team_admin'::app_role)
        OR public.is_nso_scoped_mandate(new_sales_owner, type)
      )
    )
  );

DROP POLICY IF EXISTS "Managers and above can view manager_targets" ON public.manager_targets;
CREATE POLICY "Managers and above can view manager_targets"
  ON public.manager_targets FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR (
      manager_targets.team IS NOT NULL
      AND manager_targets.team = public.auth_profile_team()
      AND (
        public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'team_admin'::app_role)
        OR public.has_role(auth.uid(), 'nso'::app_role)
      )
    )
  );
