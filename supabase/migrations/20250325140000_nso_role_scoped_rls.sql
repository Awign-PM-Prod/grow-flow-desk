-- NSO app role + read-only access scoped to New Acquisition mandates where new_sales_owner matches profile email.

-- Normalized email for current user (definer reads profiles; used in RLS)
CREATE OR REPLACE FUNCTION public.auth_profile_email_normalized()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), '')))
$$;

CREATE OR REPLACE FUNCTION public.is_nso_scoped_mandate(_new_sales_owner TEXT, _type public.mandate_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'nso'::app_role)
    AND _type = 'New Acquisition'::public.mandate_type
    AND _new_sales_owner IS NOT NULL
    AND btrim(_new_sales_owner) <> ''
    AND lower(trim(_new_sales_owner)) = NULLIF(public.auth_profile_email_normalized(), '')
$$;

ALTER TABLE public.monthly_targets
  DROP CONSTRAINT IF EXISTS monthly_targets_nso_mail_id_fkey;

-- mandates
DROP POLICY IF EXISTS "Users can view their own mandates or all if KAM/Manager" ON public.mandates;
CREATE POLICY "Users can view their own mandates or all if KAM/Manager"
  ON public.mandates FOR SELECT
  USING (
    created_by = auth.uid()
    OR kam_id = auth.uid()
    OR public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_nso_scoped_mandate(new_sales_owner, type)
  );

-- accounts (replace open SELECT)
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON public.accounts;
CREATE POLICY "Staff can view all accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "NSOs can view accounts for their mandates"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'nso'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.mandates m
      WHERE m.account_id IS NOT NULL
        AND m.account_id = accounts.id
        AND public.is_nso_scoped_mandate(m.new_sales_owner, m.type)
    )
  );

-- contacts
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
CREATE POLICY "Staff can view all contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "NSOs can view contacts for their mandate accounts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'nso'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.mandates m
      WHERE m.account_id IS NOT NULL
        AND m.account_id = contacts.account_id
        AND public.is_nso_scoped_mandate(m.new_sales_owner, m.type)
    )
  );

-- pipeline_deals
DROP POLICY IF EXISTS "Users can view their own deals or all if KAM/Manager" ON public.pipeline_deals;
CREATE POLICY "Users can view their own deals or all if KAM/Manager"
  ON public.pipeline_deals FOR SELECT
  USING (
    created_by = auth.uid()
    OR kam_id = auth.uid()
    OR public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      public.has_role(auth.uid(), 'nso'::app_role)
      AND pipeline_deals.account_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.mandates m
        WHERE m.account_id IS NOT NULL
          AND m.account_id = pipeline_deals.account_id
          AND public.is_nso_scoped_mandate(m.new_sales_owner, m.type)
      )
    )
  );

-- monthly_targets
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

-- deal_status_history
DROP POLICY IF EXISTS "Authenticated users can view status history" ON public.deal_status_history;
CREATE POLICY "Staff can view deal status history"
  ON public.deal_status_history FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "NSOs can view status history for their deals"
  ON public.deal_status_history FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'nso'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = deal_status_history.deal_id
        AND d.account_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.mandates m
          WHERE m.account_id = d.account_id
            AND public.is_nso_scoped_mandate(m.new_sales_owner, m.type)
        )
    )
  );

-- profiles: KAM rows for mandates assigned to this NSO
CREATE POLICY "NSOs can view KAM profiles on their mandates"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'nso'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.mandates m
      WHERE m.kam_id IS NOT NULL
        AND m.kam_id = profiles.id
        AND public.is_nso_scoped_mandate(m.new_sales_owner, m.type)
    )
  );

-- storage: restrict NSO reads to files under deals they can see
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;

CREATE POLICY "Staff can view pipeline deal files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pipeline-deal-status-files'
    AND (
      public.has_role(auth.uid(), 'kam'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'leadership'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

CREATE POLICY "NSOs can view pipeline deal files for their deals"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pipeline-deal-status-files'
    AND public.has_role(auth.uid(), 'nso'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id::text = split_part(name, '/', 1)
        AND d.account_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.mandates m
          WHERE m.account_id = d.account_id
            AND public.is_nso_scoped_mandate(m.new_sales_owner, m.type)
        )
    )
  );
