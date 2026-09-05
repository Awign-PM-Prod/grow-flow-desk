-- Fix NSO mandate and target access:
-- 1. NSO users have no team (team = NULL), so is_nso_scoped_mandate must be at top-level of mandates SELECT policy,
--    not nested inside `mandates.team = public.auth_profile_team()` (which is always NULL for NSO).
-- 2. is_nso_scoped_mandate should allow any mandate where the user is assigned as new_sales_owner
--    (including both New Acquisition and Existing mandates, which now support Handover Info).
-- 3. manager_targets SELECT policy should also allow NSO at top-level.
-- 4. auth_profile_email_normalized falls back to auth.jwt() ->> 'email' if profile email is missing/empty.

CREATE OR REPLACE FUNCTION public.auth_profile_email_normalized()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE(
    NULLIF((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), ''),
    auth.jwt() ->> 'email',
    ''
  )))
$$;

CREATE OR REPLACE FUNCTION public.is_nso_scoped_mandate(_new_sales_owner TEXT, _type public.mandate_type DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'nso'::app_role)
    AND _new_sales_owner IS NOT NULL
    AND btrim(_new_sales_owner) <> ''
    AND lower(trim(_new_sales_owner)) = NULLIF(public.auth_profile_email_normalized(), '')
$$;

DROP POLICY IF EXISTS "Users can view their own mandates or all if KAM/Manager" ON public.mandates;
CREATE POLICY "Users can view their own mandates or all if KAM/Manager"
  ON public.mandates FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.is_nso_scoped_mandate(new_sales_owner, type)
    OR (
      mandates.team IS NOT NULL
      AND mandates.team = public.auth_profile_team()
      AND (
        created_by = auth.uid()
        OR kam_id = auth.uid()
        OR public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'team_admin'::app_role)
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
    OR public.has_role(auth.uid(), 'nso'::app_role)
    OR (
      manager_targets.team IS NOT NULL
      AND manager_targets.team = public.auth_profile_team()
      AND (
        public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'team_admin'::app_role)
      )
    )
  );
