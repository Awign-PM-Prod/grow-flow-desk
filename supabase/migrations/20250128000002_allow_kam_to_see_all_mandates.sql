-- Allow KAM users to see all mandates (not just their own)
-- This allows KAMs to see all data when "All KAMs" filter is selected
-- The client-side filter will restrict to their own data when they select their name

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own mandates" ON public.mandates;

-- Create new SELECT policy that allows KAMs to see all mandates
-- Users can view mandates if:
-- 1. They created the mandate (created_by = auth.uid())
-- 2. They are assigned as KAM to the mandate (kam_id = auth.uid())
-- 3. They have kam, manager, leadership, or superadmin roles (can see all mandates)
CREATE POLICY "Users can view their own mandates or all if KAM/Manager"
  ON public.mandates FOR SELECT
  USING (
    created_by = auth.uid() OR 
    kam_id = auth.uid() OR
    public.has_role(auth.uid(), 'kam'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );












