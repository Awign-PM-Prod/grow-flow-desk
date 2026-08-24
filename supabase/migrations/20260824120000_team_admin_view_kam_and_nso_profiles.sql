-- Team admins assign New Sales Owner from other-team KAMs and org-wide NSO users.
-- Same-team profiles stay covered by "Team admins can view profiles on their team".
-- This does not grant UPDATE on other-team profile rows.

DROP POLICY IF EXISTS "Team admins can view KAM and NSO profiles for assignment"
  ON public.profiles;

CREATE POLICY "Team admins can view KAM and NSO profiles for assignment"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_team_admin(auth.uid())
    AND (
      profiles.role = 'kam'::app_role
      OR profiles.role = 'nso'::app_role
    )
  );

-- Team admins can now see other-team KAM ids; keep mandate owner assignment on their team.
DROP POLICY IF EXISTS "Authenticated users can create mandates" ON public.mandates;
CREATE POLICY "Authenticated users can create mandates"
  ON public.mandates FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.can_mutate_portal_data(auth.uid())
    AND (
      NOT public.is_team_admin(auth.uid())
      OR (
        public.team_admin_can_access_team(mandates.team)
        AND (
          mandates.kam_id IS NULL
          OR public.profile_on_auth_team(mandates.kam_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "KAMs can update their mandates" ON public.mandates;
CREATE POLICY "KAMs can update their mandates"
  ON public.mandates FOR UPDATE
  TO authenticated
  USING (
    public.can_mutate_portal_data(auth.uid())
    AND (
      kam_id = auth.uid()
      OR created_by = auth.uid()
      OR public.is_global_admin(auth.uid())
      OR (
        public.is_team_admin(auth.uid())
        AND public.team_admin_can_access_team(mandates.team)
      )
    )
  )
  WITH CHECK (
    public.can_mutate_portal_data(auth.uid())
    AND (
      kam_id = auth.uid()
      OR created_by = auth.uid()
      OR public.is_global_admin(auth.uid())
      OR (
        public.is_team_admin(auth.uid())
        AND public.team_admin_can_access_team(mandates.team)
      )
    )
    AND (
      NOT public.is_team_admin(auth.uid())
      OR (
        public.team_admin_can_access_team(mandates.team)
        AND (
          mandates.kam_id IS NULL
          OR public.profile_on_auth_team(mandates.kam_id)
        )
      )
    )
  );
