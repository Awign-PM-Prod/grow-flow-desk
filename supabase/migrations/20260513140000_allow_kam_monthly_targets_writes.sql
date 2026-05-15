-- KAMs could SELECT monthly_targets but INSERT/UPDATE were manager/superadmin-only
-- (leadership_read_only_rls). Allow KAMs to create/edit mandate targets for mandates
-- where they are kam_id, and new_cross_sell rows scoped to themselves.

DROP POLICY IF EXISTS "Managers and above can create targets" ON public.monthly_targets;
CREATE POLICY "Managers and above can create targets"
  ON public.monthly_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
      OR (
        public.has_role(auth.uid(), 'kam'::app_role)
        AND (
          (
            monthly_targets.mandate_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.mandates m
              WHERE m.id = monthly_targets.mandate_id
                AND m.kam_id = auth.uid()
            )
          )
          OR (
            monthly_targets.target_type::text = 'new_cross_sell'
            AND monthly_targets.kam_id = auth.uid()
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Managers and above can update targets" ON public.monthly_targets;
CREATE POLICY "Managers and above can update targets"
  ON public.monthly_targets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      public.has_role(auth.uid(), 'kam'::app_role)
      AND (
        (
          monthly_targets.mandate_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.mandates m
            WHERE m.id = monthly_targets.mandate_id
              AND m.kam_id = auth.uid()
          )
        )
        OR (
          monthly_targets.target_type::text = 'new_cross_sell'
          AND monthly_targets.kam_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      public.has_role(auth.uid(), 'kam'::app_role)
      AND (
        (
          monthly_targets.mandate_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.mandates m
            WHERE m.id = monthly_targets.mandate_id
              AND m.kam_id = auth.uid()
          )
        )
        OR (
          monthly_targets.target_type::text = 'new_cross_sell'
          AND monthly_targets.kam_id = auth.uid()
        )
      )
    )
  );
