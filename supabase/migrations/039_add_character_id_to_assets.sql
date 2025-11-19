-- Migration: 039_add_character_id_to_assets.sql
-- Description: Add character_id column to assets table for linking assets to characters
-- Date: 2024-12-XX

-- Add character_id column to assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_assets_character_id ON public.assets(character_id);

-- Add comment
COMMENT ON COLUMN public.assets.character_id IS 'Reference to character that this asset belongs to';

-- Create a function to notify when character assets are created
CREATE OR REPLACE FUNCTION notify_character_asset_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.character_id IS NOT NULL THEN
    -- Could add notification logic here if needed
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION notify_character_asset_created() TO authenticated;

