-- Allow SuperAdmins to view all profiles
CREATE POLICY "SuperAdmins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));