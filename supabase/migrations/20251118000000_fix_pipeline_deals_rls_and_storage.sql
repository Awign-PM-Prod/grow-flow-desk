-- Fix RLS policy for pipeline_deals to allow assigned KAM to update
-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update deals" ON public.pipeline_deals;

-- Create new update policy that allows:
-- 1. Creator to update
-- 2. Assigned KAM to update
-- 3. Users with kam, manager, or superadmin roles to update
CREATE POLICY "Users can update deals"
  ON public.pipeline_deals FOR UPDATE
  USING (
    created_by = auth.uid() OR
    kam_id = auth.uid() OR
    public.has_role(auth.uid(), 'kam'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Storage bucket policies for pipeline-deal-status-files
-- Note: These policies assume the bucket already exists
-- If the bucket doesn't exist, create it first in Supabase Dashboard

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Policy: Allow authenticated users to upload files
-- Since files are organized by dealId, we allow any authenticated user to upload
-- The RLS on pipeline_deals table will control who can update deals
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pipeline-deal-status-files');

-- Policy: Allow authenticated users to view files
CREATE POLICY "Authenticated users can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'pipeline-deal-status-files');

-- Policy: Allow authenticated users to update files
CREATE POLICY "Authenticated users can update files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pipeline-deal-status-files');

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pipeline-deal-status-files');

