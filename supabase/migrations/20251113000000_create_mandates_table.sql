-- Create enums for mandate fields
CREATE TYPE public.mandate_health AS ENUM ('Exceeds Expectations', 'Meets Expectations', 'Need Improvement');
CREATE TYPE public.prj_type AS ENUM ('Recurring', 'One-time');
CREATE TYPE public.upsell_constraint_type AS ENUM ('Internal', 'External');
CREATE TYPE public.upsell_constraint_sub AS ENUM ('Profitability', 'Delivery', 'Others');
CREATE TYPE public.client_budget_trend AS ENUM ('Increase', 'Same', 'Decrease');
CREATE TYPE public.awign_share_percent AS ENUM ('Below 70%', '70% & Above');
CREATE TYPE public.upsell_action_status AS ENUM ('Not Started', 'Ongoing', 'Done');

-- Create mandates table
CREATE TABLE public.mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Project Info
  project_code TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  account_id UUID, -- Will reference accounts table when it exists
  kam_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lob TEXT NOT NULL,
  
  -- Handover Info (from Demand Team)
  new_sales_owner TEXT,
  handover_monthly_volume NUMERIC(15, 2),
  handover_commercial_per_head NUMERIC(15, 2),
  handover_mcv NUMERIC(15, 2),
  prj_duration_months INTEGER CHECK (prj_duration_months >= 1 AND prj_duration_months <= 12),
  handover_acv NUMERIC(15, 2),
  handover_prj_type public.prj_type,
  
  -- Revenue Info (to be updated by KAM)
  revenue_monthly_volume NUMERIC(15, 2),
  revenue_commercial_per_head NUMERIC(15, 2),
  revenue_mcv NUMERIC(15, 2),
  revenue_acv NUMERIC(15, 2),
  revenue_prj_type public.prj_type,
  
  -- Mandate Checker
  mandate_health public.mandate_health,
  upsell_constraint BOOLEAN,
  upsell_constraint_type public.upsell_constraint_type,
  upsell_constraint_sub public.upsell_constraint_sub,
  upsell_constraint_sub2 TEXT,
  client_budget_trend public.client_budget_trend,
  awign_share_percent public.awign_share_percent,
  retention_type TEXT,
  
  -- Upsell Action Status
  upsell_action_status public.upsell_action_status,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on mandates
ALTER TABLE public.mandates ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_mandates_updated_at
  BEFORE UPDATE ON public.mandates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for mandates
-- Users can view mandates they created or are assigned as KAM
CREATE POLICY "Users can view their own mandates"
  ON public.mandates FOR SELECT
  USING (
    created_by = auth.uid() OR 
    kam_id = auth.uid() OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'leadership'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Users can insert mandates (authenticated users)
CREATE POLICY "Authenticated users can create mandates"
  ON public.mandates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- KAMs can update mandates they are assigned to
CREATE POLICY "KAMs can update their mandates"
  ON public.mandates FOR UPDATE
  USING (
    kam_id = auth.uid() OR
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Only superadmins can delete mandates
CREATE POLICY "Superadmins can delete mandates"
  ON public.mandates FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_mandates_kam_id ON public.mandates(kam_id);
CREATE INDEX idx_mandates_created_by ON public.mandates(created_by);
CREATE INDEX idx_mandates_project_code ON public.mandates(project_code);
CREATE INDEX idx_mandates_lob ON public.mandates(lob);
CREATE INDEX idx_mandates_mandate_health ON public.mandates(mandate_health);
CREATE INDEX idx_mandates_upsell_action_status ON public.mandates(upsell_action_status);

