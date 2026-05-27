-- Team Admin: superadmin-like powers scoped to the user's assigned team only.

CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'superadmin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'team_admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_global_admin(_user_id)
    OR public.is_team_admin(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.team_admin_can_access_team(_team public.team)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_global_admin(auth.uid())
    OR (
      public.is_team_admin(auth.uid())
      AND _team IS NOT NULL
      AND _team = public.auth_profile_team()
    );
$$;

CREATE OR REPLACE FUNCTION public.profile_on_auth_team(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _profile_id
      AND p.team IS NOT NULL
      AND p.team = public.auth_profile_team()
  );
$$;

CREATE OR REPLACE FUNCTION public.pipeline_deal_on_auth_team(_kam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_global_admin(auth.uid())
    OR (
      public.is_team_admin(auth.uid())
      AND _kam_id IS NOT NULL
      AND public.profile_on_auth_team(_kam_id)
    );
$$;

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
    OR public.has_role(_user_id, 'superadmin'::app_role)
    OR public.has_role(_user_id, 'team_admin'::app_role);
$$;

CREATE POLICY "Team admins can view profiles on their team"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_team_admin(auth.uid())
    AND profiles.team IS NOT NULL
    AND profiles.team = public.auth_profile_team()
    AND COALESCE(profiles.role::text, '') <> 'superadmin'
  );

CREATE POLICY "Team admins can update profiles on their team"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.is_team_admin(auth.uid())
    AND profiles.team IS NOT NULL
    AND profiles.team = public.auth_profile_team()
    AND COALESCE(profiles.role::text, '') <> 'superadmin'
  )
  WITH CHECK (
    public.is_team_admin(auth.uid())
    AND profiles.team IS NOT NULL
    AND profiles.team = public.auth_profile_team()
    AND COALESCE(profiles.role::text, '') <> 'superadmin'
  );

DROP POLICY IF EXISTS "Users can view their own mandates or all if KAM/Manager" ON public.mandates;
CREATE POLICY "Users can view their own mandates or all if KAM/Manager"
  ON public.mandates FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR (
      mandates.team IS NOT NULL
      AND mandates.team = public.auth_profile_team()
      AND (
        created_by = auth.uid()
        OR kam_id = auth.uid()
        OR public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'leadership'::app_role)
        OR public.has_role(auth.uid(), 'team_admin'::app_role)
        OR public.is_nso_scoped_mandate(new_sales_owner, type)
      )
    )
  );

DROP POLICY IF EXISTS "KAMs can update their mandates" ON public.mandates;
CREATE POLICY "KAMs can update their mandates"
  ON public.mandates FOR UPDATE
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
  );

DROP POLICY IF EXISTS "Managers and above can view manager_targets" ON public.manager_targets;
CREATE POLICY "Managers and above can view manager_targets"
  ON public.manager_targets FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR (
      manager_targets.team IS NOT NULL
      AND manager_targets.team = public.auth_profile_team()
      AND (
        public.has_role(auth.uid(), 'kam'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
        OR public.has_role(auth.uid(), 'leadership'::app_role)
        OR public.has_role(auth.uid(), 'team_admin'::app_role)
        OR public.has_role(auth.uid(), 'nso'::app_role)
      )
    )
  );

DROP POLICY IF EXISTS "Managers and above can insert manager_targets" ON public.manager_targets;
CREATE POLICY "Managers and above can insert manager_targets"
  ON public.manager_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      public.is_team_admin(auth.uid())
      AND public.team_admin_can_access_team(manager_targets.team)
    )
  );

DROP POLICY IF EXISTS "Managers and above can update manager_targets" ON public.manager_targets;
CREATE POLICY "Managers and above can update manager_targets"
  ON public.manager_targets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR (
      public.is_team_admin(auth.uid())
      AND public.team_admin_can_access_team(manager_targets.team)
    )
  );

DROP POLICY IF EXISTS "Users can view their own deals or all if KAM/Manager" ON public.pipeline_deals;
CREATE POLICY "Users can view their own deals or all if KAM/Manager"
  ON public.pipeline_deals FOR SELECT
  USING (
    created_by = auth.uid()
    OR kam_id = auth.uid()
    OR public.has_role(auth.uid(), 'kam'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'leadership'::app_role)
    OR public.is_global_admin(auth.uid())
    OR public.pipeline_deal_on_auth_team(kam_id)
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
      OR public.is_global_admin(auth.uid())
      OR public.pipeline_deal_on_auth_team(kam_id)
    )
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
      OR public.is_global_admin(auth.uid())
      OR public.is_team_admin(auth.uid())
    )
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
      OR public.is_global_admin(auth.uid())
      OR public.is_team_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers and above can create targets" ON public.monthly_targets;
CREATE POLICY "Managers and above can create targets"
  ON public.monthly_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.is_global_admin(auth.uid())
      OR public.is_team_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers and above can update targets" ON public.monthly_targets;
CREATE POLICY "Managers and above can update targets"
  ON public.monthly_targets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_global_admin(auth.uid())
    OR public.is_team_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Superadmins can delete deals" ON public.pipeline_deals;
CREATE POLICY "Superadmins can delete deals"
  ON public.pipeline_deals FOR DELETE
  USING (
    public.is_global_admin(auth.uid())
    OR public.pipeline_deal_on_auth_team(kam_id)
  );
