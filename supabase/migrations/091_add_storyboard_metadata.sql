-- Migration: 091_add_storyboard_metadata.sql
-- Description: Store multi character/location assignments on storyboards

ALTER TABLE public.storyboards
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.storyboards.metadata IS
  'Extra storyboard data (character_ids, location_ids arrays for multi-assignment)';
