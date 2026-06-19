-- Restructure the Line of Business / Use Case / Sub Use Case taxonomy.
--
-- This migration only RENAMES and ADDS enum values. The data backfill that
-- *uses* the newly added values lives in a separate migration
-- (20260619120100_backfill_lob_taxonomy.sql) because Postgres does not allow a
-- newly added enum value to be used in the same transaction it was created in.
--
-- Deprecated values (Digital Gigs, New Business Line, Staffing, Loyalty Programs,
-- Staffing - Core, and the audit sub use cases) are intentionally NOT dropped --
-- Postgres cannot remove enum values in place. They simply stop being offered in
-- the application after the matching code change.

-- ── LoB renames (in place, preserves existing rows) ─────────────────────────
ALTER TYPE public.lob RENAME VALUE 'AI Ops' TO 'AI Operations';
ALTER TYPE public.lob RENAME VALUE 'Installation and maintenance' TO 'Installation & Maintenance';

-- ── New LoB values (3-way staffing split) ───────────────────────────────────
ALTER TYPE public.lob ADD VALUE IF NOT EXISTS 'Staffing (Anchal)';
ALTER TYPE public.lob ADD VALUE IF NOT EXISTS 'Staffing (Prashant)';
ALTER TYPE public.lob ADD VALUE IF NOT EXISTS 'Staffing (Core)';

-- ── New Use Case values ─────────────────────────────────────────────────────
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Device Pickup';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Retail Onboarding';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Physical AI';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Voice AI';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'IT Expert';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Smart Meter';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'EV';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Broadband';
ALTER TYPE public.use_case ADD VALUE IF NOT EXISTS 'Staffing - SaaS';

-- ── New Sub Use Case values (Installation & Maintenance) ────────────────────
ALTER TYPE public.sub_use_case ADD VALUE IF NOT EXISTS 'Per Installation Pay';
ALTER TYPE public.sub_use_case ADD VALUE IF NOT EXISTS 'Fixed Pay';
