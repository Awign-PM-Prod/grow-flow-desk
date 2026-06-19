-- Backfill existing rows onto the new LoB taxonomy.
-- Runs after 20260619120000_restructure_lob_taxonomy.sql so the new enum values
-- are committed and safe to use here.

-- Digital Gigs is folded into Diligence & Audit (its use cases Content
-- Operations / Telecalling are now valid use cases there).
UPDATE public.mandates SET lob = 'Diligence & Audit' WHERE lob = 'Digital Gigs';
UPDATE public.pipeline_deals SET lob = 'Diligence & Audit' WHERE lob = 'Digital Gigs';

-- Staffing-team mandates (old single Staffing + New Business Line) split by type:
--   Existing  -> Staffing (Core)
--   otherwise -> Staffing (Prashant)
UPDATE public.mandates
SET lob = 'Staffing (Core)'
WHERE lob IN ('Staffing', 'New Business Line')
  AND type = 'Existing';

UPDATE public.mandates
SET lob = 'Staffing (Prashant)'
WHERE lob IN ('Staffing', 'New Business Line')
  AND (type IS DISTINCT FROM 'Existing');

-- Pipeline deals are cross-sell (no Existing type) -> Staffing (Prashant).
UPDATE public.pipeline_deals
SET lob = 'Staffing (Prashant)'
WHERE lob IN ('Staffing', 'New Business Line');

-- The single legacy 'Staffing - Core' use-case mandate moves to the Staffing
-- (Core) LoB as an Existing mandate with use case Staffing.
UPDATE public.mandates
SET lob = 'Staffing (Core)',
    type = 'Existing',
    use_case = 'Staffing'
WHERE use_case = 'Staffing - Core';
