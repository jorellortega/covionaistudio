-- Add leonardo_api_key column to users table
-- Run this in your Supabase SQL Editor

-- Add the leonardo_api_key column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS leonardo_api_key TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public' 
  AND column_name = 'leonardo_api_key';

-- Show all API key columns for verification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public' 
  AND column_name LIKE '%_api_key'
ORDER BY column_name;
