-- Create monthly_targets table
CREATE TABLE public.monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Target Info
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  financial_year TEXT NOT NULL,
  target NUMERIC(15, 2) NOT NULL CHECK (target > 0),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ensure unique target per month/year combination
  UNIQUE (month, year)
);

-- Enable RLS on monthly_targets
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monthly_targets
-- Only managers, leadership, and superadmins can view targets
CREATE POLICY "Managers and above can view targets"
  ON public.monthly_targets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Only managers, leadership, and superadmins can create targets
CREATE POLICY "Managers and above can create targets"
  ON public.monthly_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.has_role(auth.uid(), 'manager'::app_role) OR
      public.has_role(auth.uid(), 'leadership'::app_role) OR
      public.has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

-- Only managers, leadership, and superadmins can update targets
CREATE POLICY "Managers and above can update targets"
  ON public.monthly_targets FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Only superadmins can delete targets
CREATE POLICY "Superadmins can delete targets"
  ON public.monthly_targets FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Create indexes for faster queries
CREATE INDEX idx_monthly_targets_year ON public.monthly_targets(year DESC);
CREATE INDEX idx_monthly_targets_month_year ON public.monthly_targets(year DESC, month DESC);
CREATE INDEX idx_monthly_targets_financial_year ON public.monthly_targets(financial_year);
CREATE INDEX idx_monthly_targets_created_by ON public.monthly_targets(created_by);
CREATE INDEX idx_monthly_targets_created_at ON public.monthly_targets(created_at DESC);















