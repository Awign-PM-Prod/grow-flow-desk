-- Bulk mandate upload: resolve account names globally (bypasses RLS on accounts),
-- using case-insensitive trimmed matching.

CREATE OR REPLACE FUNCTION public.accounts_lookup_by_names(_names text[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.name
  FROM public.accounts a
  WHERE _names IS NOT NULL
    AND cardinality(_names) > 0
    AND EXISTS (
      SELECT 1
      FROM unnest(_names) AS n(raw_name)
      WHERE lower(trim(a.name)) = lower(trim(n.raw_name))
    );
$$;

REVOKE ALL ON FUNCTION public.accounts_lookup_by_names(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accounts_lookup_by_names(text[]) TO authenticated;
