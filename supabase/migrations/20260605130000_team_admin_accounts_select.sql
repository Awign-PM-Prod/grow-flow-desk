-- Team admins need account names on cross-sell targets for mandates on their team.

CREATE POLICY "Team admins can view accounts for their team mandates"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    public.is_team_admin(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.mandates m
      WHERE m.account_id IS NOT NULL
        AND m.account_id = accounts.id
        AND public.team_admin_can_access_team(m.team)
    )
  );
