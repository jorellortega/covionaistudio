-- Migration: 074_add_status_badge_to_casting.sql
-- Description: Add optional status badge/banner overlay to casting pages
-- Date: 2025-01-XX

-- Add status badge fields to casting_settings table
ALTER TABLE public.casting_settings
  ADD COLUMN IF NOT EXISTS status_badge_text TEXT,
  ADD COLUMN IF NOT EXISTS status_badge_color TEXT DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS status_badge_enabled BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN public.casting_settings.status_badge_text IS 'Text to display on the status badge (e.g., "Open", "Filled", "Pending")';
COMMENT ON COLUMN public.casting_settings.status_badge_color IS 'Color theme for the badge: green, red, yellow, blue, purple, orange';
COMMENT ON COLUMN public.casting_settings.status_badge_enabled IS 'Whether to show the status badge overlay on the casting page';
