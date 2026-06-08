-- Team admins could mutate monthly_targets but SELECT policy omitted team_admin,
-- so upsell / cross-sell target pages returned no rows for that role.

DROP POLICY IF EXISTS "KAMs and above can view targets" ON public.monthly_targets;
CREATE POLICY "KAMs and above can view targets"
  ON public.monthly_targets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      public.is_team_admin(auth.uid())
      AND (
        (
          monthly_targets.mandate_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.mandates m
            WHERE m.id = monthly_targets.mandate_id
              AND public.team_admin_can_access_team(m.team)
          )
        )
        OR (
          monthly_targets.target_type::text = 'new_cross_sell'
          AND monthly_targets.kam_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = monthly_targets.kam_id
              AND public.team_admin_can_access_team(p.team)
          )
        )
      )
    )
    OR (
      public.has_role(auth.uid(), 'nso'::app_role)
      AND (
        (
          monthly_targets.nso_mail_id IS NOT NULL
          AND lower(trim(monthly_targets.nso_mail_id)) = public.auth_profile_email_normalized()
          AND public.auth_profile_email_normalized() <> ''
        )
        OR (
          monthly_targets.mandate_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.mandates m
            WHERE m.id = monthly_targets.mandate_id
              AND public.is_nso_scoped_mandate(m.new_sales_owner, m.type)
          )
        )
      )
    )
  );
