-- Lets bulk-upload preview detect project codes that already exist globally
-- (including mandates hidden from the caller by RLS).

CREATE OR REPLACE FUNCTION public.mandates_project_codes_exist(_codes text[])
RETURNS TABLE(project_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.project_code
  FROM public.mandates m
  WHERE _codes IS NOT NULL
    AND cardinality(_codes) > 0
    AND m.project_code = ANY(_codes);
$$;

REVOKE ALL ON FUNCTION public.mandates_project_codes_exist(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mandates_project_codes_exist(text[]) TO authenticated;
