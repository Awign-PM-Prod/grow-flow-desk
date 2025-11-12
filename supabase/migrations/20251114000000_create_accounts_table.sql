-- Create accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  address TEXT NOT NULL,
  founded_year INTEGER NOT NULL CHECK (founded_year >= 1800 AND founded_year <= 2100),
  
  -- Industry Info
  industry TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  
  -- Company Size
  revenue_range TEXT NOT NULL,
  
  -- Auto-calculated fields (from related mandates)
  total_acv NUMERIC(15, 2) DEFAULT 0,
  total_mcv NUMERIC(15, 2) DEFAULT 0,
  mcv_tier TEXT,
  company_size_tier TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for accounts
-- Users can view all accounts (authenticated users)
CREATE POLICY "Authenticated users can view accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create accounts
CREATE POLICY "Authenticated users can create accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update accounts they created, or KAMs/Managers can update
CREATE POLICY "Users can update accounts"
  ON public.accounts FOR UPDATE
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'kam'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Only superadmins can delete accounts
CREATE POLICY "Superadmins can delete accounts"
  ON public.accounts FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Create indexes for faster queries
CREATE INDEX idx_accounts_name ON public.accounts(name);
CREATE INDEX idx_accounts_industry ON public.accounts(industry);
CREATE INDEX idx_accounts_revenue_range ON public.accounts(revenue_range);
CREATE INDEX idx_accounts_created_by ON public.accounts(created_by);

-- Update mandates table to add foreign key constraint for account_id
ALTER TABLE public.mandates
  ADD CONSTRAINT mandates_account_id_fkey 
  FOREIGN KEY (account_id) 
  REFERENCES public.accounts(id) 
  ON DELETE SET NULL;

