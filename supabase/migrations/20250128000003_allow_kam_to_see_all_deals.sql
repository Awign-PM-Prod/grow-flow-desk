-- Allow KAM users to see all pipeline deals (not just their own)
-- This allows KAMs to see all data when "All KAMs" filter is selected
-- The client-side filter will restrict to their own data when they select their name

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own deals or assigned deals" ON public.pipeline_deals;

-- Create new SELECT policy that allows KAMs to see all deals
-- Users can view deals if:
-- 1. They created the deal (created_by = auth.uid())
-- 2. They are assigned as KAM to the deal (kam_id = auth.uid())
-- 3. They have kam, manager, leadership, or superadmin roles (can see all deals)
CREATE POLICY "Users can view their own deals or all if KAM/Manager"
  ON public.pipeline_deals FOR SELECT
  USING (
    created_by = auth.uid() OR 
    kam_id = auth.uid() OR
    public.has_role(auth.uid(), 'kam'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );









