-- Allow KAM users to view monthly targets (read-only access)
-- This allows KAMs to see targets data on the dashboard

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Managers and above can view targets" ON public.monthly_targets;

-- Create new SELECT policy that allows KAMs, managers, leadership, and superadmins to view targets
CREATE POLICY "KAMs and above can view targets"
  ON public.monthly_targets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'kam'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );




















