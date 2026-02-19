-- Create manager_targets table for dashboard "target this month" card
-- One row per month/year; Existing_Target and New_Ac_Target are shown based on dashboard filter
CREATE TABLE public.manager_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  existing_target NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (existing_target >= 0),
  new_ac_target NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (new_ac_target >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

-- Enable RLS
ALTER TABLE public.manager_targets ENABLE ROW LEVEL SECURITY;

-- Managers, leadership, and superadmins can view
CREATE POLICY "Managers and above can view manager_targets"
  ON public.manager_targets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Managers, leadership, and superadmins can insert
CREATE POLICY "Managers and above can insert manager_targets"
  ON public.manager_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Managers, leadership, and superadmins can update
CREATE POLICY "Managers and above can update manager_targets"
  ON public.manager_targets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Superadmins can delete
CREATE POLICY "Superadmins can delete manager_targets"
  ON public.manager_targets FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE INDEX idx_manager_targets_month_year ON public.manager_targets(year DESC, month DESC);
