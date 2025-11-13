-- Create pipeline_deals table
CREATE TABLE public.pipeline_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sales Module Info
  sales_module_name TEXT NOT NULL,
  kam_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Deal Details
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  spoc_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  spoc2_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  spoc3_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lob TEXT NOT NULL,
  use_case TEXT NOT NULL,
  sub_use_case TEXT NOT NULL,
  
  -- Volume & Commercial Info
  monthly_volume NUMERIC(15, 2) NOT NULL,
  max_monthly_volume NUMERIC(15, 2) NOT NULL,
  commercial_per_head NUMERIC(15, 2) NOT NULL,
  expected_revenue NUMERIC(15, 2) NOT NULL,
  mpv NUMERIC(15, 2) NOT NULL,
  max_mpv NUMERIC(15, 2) NOT NULL,
  
  -- Project Info
  prj_duration_months INTEGER NOT NULL,
  gm_threshold NUMERIC(15, 2),
  prj_frequency TEXT NOT NULL CHECK (prj_frequency IN ('One-Time', 'Recurring')),
  status TEXT NOT NULL DEFAULT 'Listed',
  prj_start_date DATE NOT NULL,
  probability INTEGER NOT NULL DEFAULT 10,
  
  -- Status-based fields (Proposal Stage)
  solution_proposal_slides TEXT,
  gantt_chart_url TEXT,
  expected_contract_sign_date DATE,
  
  -- Status-based fields (Closed Won)
  contract_sign_date DATE,
  signed_contract_link TEXT,
  
  -- Status-based fields (Dropped)
  dropped_reason TEXT,
  dropped_reason_others TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on pipeline_deals
ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_pipeline_deals_updated_at
  BEFORE UPDATE ON public.pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for pipeline_deals
-- Users can view all deals (authenticated users)
CREATE POLICY "Authenticated users can view deals"
  ON public.pipeline_deals FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create deals
CREATE POLICY "Authenticated users can create deals"
  ON public.pipeline_deals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update deals they created, or KAMs/Managers can update
CREATE POLICY "Users can update deals"
  ON public.pipeline_deals FOR UPDATE
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'kam'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Only superadmins can delete deals
CREATE POLICY "Superadmins can delete deals"
  ON public.pipeline_deals FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Create indexes for faster queries
CREATE INDEX idx_pipeline_deals_account_id ON public.pipeline_deals(account_id);
CREATE INDEX idx_pipeline_deals_kam_id ON public.pipeline_deals(kam_id);
CREATE INDEX idx_pipeline_deals_status ON public.pipeline_deals(status);
CREATE INDEX idx_pipeline_deals_lob ON public.pipeline_deals(lob);
CREATE INDEX idx_pipeline_deals_created_by ON public.pipeline_deals(created_by);
CREATE INDEX idx_pipeline_deals_created_at ON public.pipeline_deals(created_at DESC);



