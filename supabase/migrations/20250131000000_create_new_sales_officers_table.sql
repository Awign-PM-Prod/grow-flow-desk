-- Create new_sales_officers table
CREATE TABLE public.new_sales_officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  mail_id TEXT NOT NULL UNIQUE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on new_sales_officers
ALTER TABLE public.new_sales_officers ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_new_sales_officers_updated_at
  BEFORE UPDATE ON public.new_sales_officers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for new_sales_officers
-- Only superadmins can view NSOs
CREATE POLICY "Superadmins can view new_sales_officers"
  ON public.new_sales_officers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Only superadmins can create NSOs
CREATE POLICY "Superadmins can create new_sales_officers"
  ON public.new_sales_officers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin'::app_role) AND
    auth.uid() = created_by
  );

-- Only superadmins can update NSOs
CREATE POLICY "Superadmins can update new_sales_officers"
  ON public.new_sales_officers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Only superadmins can delete NSOs
CREATE POLICY "Superadmins can delete new_sales_officers"
  ON public.new_sales_officers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Create indexes for faster queries
CREATE INDEX idx_new_sales_officers_mail_id ON public.new_sales_officers(mail_id);
CREATE INDEX idx_new_sales_officers_created_by ON public.new_sales_officers(created_by);



