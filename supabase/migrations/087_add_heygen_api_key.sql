-- Migration: 087_add_heygen_api_key.sql
-- Description: Add heygen_api_key column to users table for HeyGen Digital Twin integration

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS heygen_api_key TEXT;

COMMENT ON COLUMN public.users.heygen_api_key IS 'HeyGen API key for digital twin and avatar video generation';
