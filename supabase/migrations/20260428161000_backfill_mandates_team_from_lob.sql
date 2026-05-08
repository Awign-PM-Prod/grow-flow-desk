-- Backfill mandate team based on LoB rules:
-- Staffing -> staffing
-- Awign Expert / Awign Experts -> experts
-- everything else -> ce
UPDATE public.mandates
SET team = CASE
  WHEN lower(trim(COALESCE(lob::text, ''))) = 'staffing' THEN 'staffing'::public.team
  WHEN lower(trim(COALESCE(lob::text, ''))) IN ('awign expert', 'awign experts') THEN 'experts'::public.team
  ELSE 'ce'::public.team
END;
