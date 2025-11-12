-- Split address field into separate fields: address (street), city, state, country
-- Add new columns for city, state, and country
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- Note: The existing 'address' field will now represent the street address
-- Existing data in 'address' field will remain unchanged
-- You may want to manually migrate existing address data if needed

-- Create indexes for the new fields for faster queries
CREATE INDEX IF NOT EXISTS idx_accounts_city ON public.accounts(city);
CREATE INDEX IF NOT EXISTS idx_accounts_state ON public.accounts(state);
CREATE INDEX IF NOT EXISTS idx_accounts_country ON public.accounts(country);

