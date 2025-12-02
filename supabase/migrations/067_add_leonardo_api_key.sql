-- Migration: 067_add_leonardo_api_key.sql
-- Description: Add leonardo_api_key column to users table for Leonardo AI integration
-- Date: 2025-01-XX

-- Add the leonardo_api_key column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS leonardo_api_key TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.users.leonardo_api_key IS 'Leonardo AI API key for image and video generation';

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'leonardo_api_key'
  ) THEN
    RAISE EXCEPTION 'Column leonardo_api_key was not added successfully';
  END IF;
END $$;

