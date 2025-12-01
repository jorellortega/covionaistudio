-- Migration: 066_add_character_type_and_casting_filters.sql
-- Description: Add character_type field to characters and show/hide filters to casting_settings
-- Date: 2024-12-XX

-- Add character_type to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS character_type TEXT DEFAULT 'main' 
    CHECK (character_type IN ('main', 'supporting', 'extra', 'cameo', 'voice', 'stunt'));

-- Add show_on_casting to characters table (individual toggle for each character)
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS show_on_casting BOOLEAN DEFAULT true;

-- Add index for character_type
CREATE INDEX IF NOT EXISTS idx_characters_character_type ON public.characters(character_type);

-- Add index for show_on_casting
CREATE INDEX IF NOT EXISTS idx_characters_show_on_casting ON public.characters(show_on_casting);

-- Add show_character_types array to casting_settings table
-- This controls which character types are visible on the public casting page
ALTER TABLE public.casting_settings
  ADD COLUMN IF NOT EXISTS show_character_types TEXT[] DEFAULT ARRAY['main', 'supporting']::TEXT[];

-- Add comments
COMMENT ON COLUMN public.characters.character_type IS 'Type of character: main, supporting, extra, cameo, voice, or stunt';
COMMENT ON COLUMN public.characters.show_on_casting IS 'Whether this character should be displayed on the public casting page';
COMMENT ON COLUMN public.casting_settings.show_character_types IS 'Array of character types to show on public casting page (e.g., ["main", "supporting"])';

