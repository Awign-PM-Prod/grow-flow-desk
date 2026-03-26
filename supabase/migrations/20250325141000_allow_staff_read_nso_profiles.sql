-- KAMs and above need to list NSO users for mandate assignment (profiles.role = nso).
-- Without this, only superadmin/manager/leadership "view all" and self-read apply; KAMs cannot see NSO profiles.

CREATE POLICY "Staff can view NSO profiles for assignment"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    profiles.role = 'nso'::app_role
    AND (
      public.has_role(auth.uid(), 'kam'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'leadership'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );
