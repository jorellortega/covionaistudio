-- Migration: 084_add_stability_api_key.sql
-- Description: Add stability_api_key column to users table for Stability AI integration
-- Date: 2026-07-20

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stability_api_key TEXT;

COMMENT ON COLUMN public.users.stability_api_key IS 'Stability AI API key for Stable Image generation and editing';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'stability_api_key'
  ) THEN
    RAISE EXCEPTION 'Column stability_api_key was not added successfully';
  END IF;
END $$;
