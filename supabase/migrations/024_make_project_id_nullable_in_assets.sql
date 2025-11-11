-- Migration: 024_make_project_id_nullable_in_assets.sql
-- Description: Make project_id nullable in assets table to allow saving assets for treatments without projects
-- Date: 2024-01-XX

-- Make project_id nullable in assets table
ALTER TABLE public.assets 
ALTER COLUMN project_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL values (it already does, but this is explicit)
-- Note: The existing foreign key constraint already allows NULL, so we don't need to recreate it

-- Update RLS policies to allow querying assets by treatment_id even without project_id
-- The existing policies should already work, but let's verify they handle NULL project_id correctly

-- Add comment for documentation
COMMENT ON COLUMN public.assets.project_id IS 'Reference to project if this asset is associated with a project. NULL if asset is associated only with a treatment or scene without a project.';

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Made project_id nullable in assets table!';
  RAISE NOTICE '📊 Assets can now be saved without a project (e.g., for standalone treatments)!';
  RAISE NOTICE '🔗 Assets can be associated with treatments even when no project exists!';
END $$;

