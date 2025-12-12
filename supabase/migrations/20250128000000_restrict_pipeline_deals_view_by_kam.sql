-- Restrict pipeline_deals view to KAM users - they can only see deals linked to them
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view deals" ON public.pipeline_deals;

-- Create new SELECT policy that restricts KAM users to their own deals
-- Users can view deals if:
-- 1. They created the deal (created_by = auth.uid())
-- 2. They are assigned as KAM to the deal (kam_id = auth.uid())
-- 3. They have manager, leadership, or superadmin roles (can see all deals)
CREATE POLICY "Users can view their own deals or assigned deals"
  ON public.pipeline_deals FOR SELECT
  USING (
    created_by = auth.uid() OR 
    kam_id = auth.uid() OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

