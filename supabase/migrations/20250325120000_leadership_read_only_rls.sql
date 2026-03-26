-- Leadership: full read (existing SELECT policies) but no CRM writes or pipeline file mutations.
-- Kam, manager, and superadmin can still mutate per existing rules, except where INSERT already excluded KAM.

CREATE OR REPLACE FUNCTION public.can_mutate_portal_data(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'kam'::app_role)
    OR public.has_role(_user_id, 'manager'::app_role)
    OR public.has_role(_user_id, 'superadmin'::app_role);
$$;

-- accounts
DROP POLICY IF EXISTS "Authenticated users can create accounts" ON public.accounts;
CREATE POLICY "Authenticated users can create accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.can_mutate_portal_data(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update accounts" ON public.accounts;
CREATE POLICY "Users can update accounts"
  ON public.accounts FOR UPDATE
  USING (
    public.can_mutate_portal_data(auth.uid())
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'kam'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

-- contacts
DROP POLICY IF EXISTS "Authenticated users can create contacts" ON public.contacts;
CREATE POLICY "Authenticated users can create contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.can_mutate_portal_data(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;
CREATE POLICY "Users can update contacts"
  ON public.contacts FOR UPDATE
  USING (
    public.can_mutate_portal_data(auth.uid())
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'kam'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

-- mandates
DROP POLICY IF EXISTS "Authenticated users can create mandates" ON public.mandates;
CREATE POLICY "Authenticated users can create mandates"
  ON public.mandates FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.can_mutate_portal_data(auth.uid())
  );

DROP POLICY IF EXISTS "KAMs can update their mandates" ON public.mandates;
CREATE POLICY "KAMs can update their mandates"
  ON public.mandates FOR UPDATE
  USING (
    public.can_mutate_portal_data(auth.uid())
    AND (
      kam_id = auth.uid()
      OR created_by = auth.uid()
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

-- pipeline_deals
DROP POLICY IF EXISTS "Authenticated users can create deals" ON public.pipeline_deals;
CREATE POLICY "Authenticated users can create deals"
  ON public.pipeline_deals FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.can_mutate_portal_data(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update deals" ON public.pipeline_deals;
CREATE POLICY "Users can update deals"
  ON public.pipeline_deals FOR UPDATE
  USING (
    public.can_mutate_portal_data(auth.uid())
    AND (
      created_by = auth.uid()
      OR kam_id = auth.uid()
      OR public.has_role(auth.uid(), 'kam'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

-- monthly_targets (writes: managers + superadmin only, same as before minus leadership)
DROP POLICY IF EXISTS "Managers and above can create targets" ON public.monthly_targets;
CREATE POLICY "Managers and above can create targets"
  ON public.monthly_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

DROP POLICY IF EXISTS "Managers and above can update targets" ON public.monthly_targets;
CREATE POLICY "Managers and above can update targets"
  ON public.monthly_targets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- manager_targets
DROP POLICY IF EXISTS "Managers and above can insert manager_targets" ON public.manager_targets;
CREATE POLICY "Managers and above can insert manager_targets"
  ON public.manager_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

DROP POLICY IF EXISTS "Managers and above can update manager_targets" ON public.manager_targets;
CREATE POLICY "Managers and above can update manager_targets"
  ON public.manager_targets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- deal_status_history
DROP POLICY IF EXISTS "System can insert status history" ON public.deal_status_history;
CREATE POLICY "System can insert status history"
  ON public.deal_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.can_mutate_portal_data(auth.uid()));

-- storage: pipeline deal files (same bucket as 20251118000000)
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pipeline-deal-status-files'
    AND public.can_mutate_portal_data(auth.uid())
  );

CREATE POLICY "Authenticated users can update files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pipeline-deal-status-files'
    AND public.can_mutate_portal_data(auth.uid())
  );

CREATE POLICY "Authenticated users can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pipeline-deal-status-files'
    AND public.can_mutate_portal_data(auth.uid())
  );
