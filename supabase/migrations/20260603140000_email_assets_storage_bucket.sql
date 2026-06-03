-- Public bucket for email templates (logo, etc.). Upload awign-email-logo.png via Dashboard or CLI.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-assets',
  'email-assets',
  true,
  524288,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anyone can read (required for Gmail/Outlook to load images in emails)
DROP POLICY IF EXISTS "Public read email assets" ON storage.objects;
CREATE POLICY "Public read email assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'email-assets');

-- Admins can manage files in this bucket
DROP POLICY IF EXISTS "Admins upload email assets" ON storage.objects;
CREATE POLICY "Admins upload email assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'email-assets'
    AND public.is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "Admins update email assets" ON storage.objects;
CREATE POLICY "Admins update email assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND public.is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "Admins delete email assets" ON storage.objects;
CREATE POLICY "Admins delete email assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND public.is_admin_user(auth.uid())
  );
