-- Migration: 008_add_version_name.sql
-- Description: Add version_name column to assets table for custom version labeling
-- Date: 2024-01-01

-- Add version_name column to assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS version_name TEXT;

-- Create index for version_name for better performance
CREATE INDEX IF NOT EXISTS idx_assets_version_name ON public.assets(version_name);

-- Update existing assets to have default version names
UPDATE public.assets 
SET version_name = CONCAT('Version ', version::text)
WHERE version_name IS NULL;

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Version name column added successfully!';
  RAISE NOTICE '📊 Column: version_name added to assets table';
  RAISE NOTICE '🔍 Index created for better performance';
  RAISE NOTICE '📝 You can now add custom names to your versions!';
END $$;
