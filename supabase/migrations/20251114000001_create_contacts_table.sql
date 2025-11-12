-- Create contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account Reference
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  department TEXT NOT NULL,
  kra TEXT,
  title TEXT NOT NULL,
  
  -- Level and Zone
  level TEXT NOT NULL CHECK (level IN ('Lv.1', 'Lv.2', 'Lv.3')),
  zone TEXT NOT NULL CHECK (zone IN ('Central', 'Regional')),
  region TEXT,
  
  -- Reporting
  reports_to TEXT,
  
  -- Positioning
  positioning TEXT NOT NULL CHECK (positioning IN ('Decision Maker', 'Influencer')),
  awign_champion BOOLEAN NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for contacts
-- Users can view all contacts (authenticated users)
CREATE POLICY "Authenticated users can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create contacts
CREATE POLICY "Authenticated users can create contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update contacts they created, or KAMs/Managers can update
CREATE POLICY "Users can update contacts"
  ON public.contacts FOR UPDATE
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'kam'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Only superadmins can delete contacts
CREATE POLICY "Superadmins can delete contacts"
  ON public.contacts FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Create indexes for faster queries
CREATE INDEX idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_name ON public.contacts(first_name, last_name);
CREATE INDEX idx_contacts_created_by ON public.contacts(created_by);

