-- Account visibility:
-- - Team admins: all accounts (same as manager / superadmin)
-- - KAMs: only accounts that have at least one mandate where they are the KAM

DROP POLICY IF EXISTS "Staff can view all accounts" ON public.accounts;
CREATE POLICY "Staff can view all accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_team_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Team admins can view accounts for their team mandates" ON public.accounts;

CREATE POLICY "KAMs can view accounts for their mandates"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'kam'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.mandates m
      WHERE m.account_id IS NOT NULL
        AND m.account_id = accounts.id
        AND m.kam_id = auth.uid()
    )
  );
