-- Update MCV Tier for all accounts based on Total MCV
-- Tier 1: Total MCV > 1 CR (10,000,000)
-- Tier 2: Total MCV <= 1 CR (default)

UPDATE public.accounts
SET mcv_tier = CASE
  WHEN total_mcv > 10000000 THEN 'Tier 1'::public.mcv_tier
  ELSE 'Tier 2'::public.mcv_tier
END
WHERE total_mcv IS NOT NULL;

-- Also set Tier 2 for accounts with null total_mcv
UPDATE public.accounts
SET mcv_tier = 'Tier 2'::public.mcv_tier
WHERE total_mcv IS NULL AND (mcv_tier IS NULL OR mcv_tier != 'Tier 1'::public.mcv_tier);

