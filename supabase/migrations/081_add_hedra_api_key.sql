-- Migration: 081_add_hedra_api_key.sql
-- Description: Add hedra_api_key column to users table for Hedra AI integration
-- Date: 2026-06-27

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS hedra_api_key TEXT;

COMMENT ON COLUMN public.users.hedra_api_key IS 'Hedra API key for avatar and video generation';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'hedra_api_key'
  ) THEN
    RAISE EXCEPTION 'Column hedra_api_key was not added successfully';
  END IF;
END $$;
