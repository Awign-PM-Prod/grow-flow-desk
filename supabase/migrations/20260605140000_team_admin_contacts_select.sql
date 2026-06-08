-- Team admins can view contacts and pipeline deals on accounts linked to mandates on their team.

CREATE POLICY "Team admins can view contacts for their team mandate accounts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    public.is_team_admin(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.mandates m
      WHERE m.account_id IS NOT NULL
        AND m.account_id = contacts.account_id
        AND public.team_admin_can_access_team(m.team)
    )
  );

CREATE POLICY "Team admins can view pipeline deals for their team mandate accounts"
  ON public.pipeline_deals FOR SELECT
  TO authenticated
  USING (
    public.is_team_admin(auth.uid())
    AND pipeline_deals.account_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.mandates m
      WHERE m.account_id = pipeline_deals.account_id
        AND public.team_admin_can_access_team(m.team)
    )
  );
