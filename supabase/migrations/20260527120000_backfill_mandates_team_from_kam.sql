-- Re-align mandate team with assigned KAM profile team (replaces LoB-derived team).
UPDATE public.mandates m
SET team = p.team::public.team
FROM public.profiles p
WHERE m.kam_id = p.id
  AND p.team IS NOT NULL;
