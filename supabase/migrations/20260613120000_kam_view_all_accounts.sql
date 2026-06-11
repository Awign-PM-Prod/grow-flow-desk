-- KAMs can view all accounts (not limited to accounts with their mandates).

DROP POLICY IF EXISTS "Staff can view all accounts" ON public.accounts;
CREATE POLICY "Staff can view all accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_team_admin(auth.uid())
  );

DROP POLICY IF EXISTS "KAMs can view accounts for their mandates" ON public.accounts;
