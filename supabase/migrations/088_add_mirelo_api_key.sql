-- Migration: 088_add_mirelo_api_key.sql
-- Description: Add mirelo_api_key column to users table for Mirelo SFX integration

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS mirelo_api_key TEXT;

COMMENT ON COLUMN public.users.mirelo_api_key IS 'Mirelo API key for AI sound effects (text-to-SFX and video-to-SFX)';
