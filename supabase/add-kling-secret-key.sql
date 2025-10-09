-- Add Kling Secret Key column to users table
-- This script adds support for both Kling API keys (access and secret)

-- Add the kling_secret_key column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS kling_secret_key TEXT;

-- Add a comment to document the purpose
COMMENT ON COLUMN users.kling_secret_key IS 'Kling AI secret key for API authentication';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('kling_api_key', 'kling_secret_key')
ORDER BY column_name;
