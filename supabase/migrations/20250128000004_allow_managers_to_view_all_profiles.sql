-- Allow managers and leadership to view all profiles
-- This is needed for KAM filters and other features where managers need to see all users

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Managers and leadership can view all profiles" ON public.profiles;

-- Create policy for managers and leadership to view all profiles
CREATE POLICY "Managers and leadership can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

