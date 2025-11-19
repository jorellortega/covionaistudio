-- Migration: 035_add_is_default_cover_to_assets.sql
-- Description: Add is_default_cover boolean to assets table for marking default cover images
-- Date: 2024-01-XX

-- Add is_default_cover column to assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS is_default_cover BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_is_default_cover ON public.assets(project_id, is_default_cover) 
WHERE is_default_cover = TRUE;

-- Create a function to ensure only one default cover per project
CREATE OR REPLACE FUNCTION ensure_single_default_cover()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this asset as default cover, unset all other default covers for the same project
  IF NEW.is_default_cover = TRUE AND NEW.project_id IS NOT NULL THEN
    UPDATE public.assets
    SET is_default_cover = FALSE
    WHERE project_id = NEW.project_id
      AND id != NEW.id
      AND is_default_cover = TRUE
      AND content_type = 'image';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single default cover per project
DROP TRIGGER IF EXISTS trigger_ensure_single_default_cover ON public.assets;
CREATE TRIGGER trigger_ensure_single_default_cover
  BEFORE INSERT OR UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_cover();

-- Comment on column
COMMENT ON COLUMN public.assets.is_default_cover IS 'Whether this asset is the default cover image for the project';

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Added is_default_cover column to assets table!';
  RAISE NOTICE '📊 Created index for default cover queries';
  RAISE NOTICE '🔒 Created trigger to ensure single default cover per project';
END $$;

