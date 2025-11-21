-- Migration: 048_add_location_id_to_assets.sql
-- Description: Add location_id column to assets table to link assets to locations
-- Date: 2025-01-XX

-- Add location_id column to assets table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_assets_location_id ON public.assets(location_id);

-- Add comment
COMMENT ON COLUMN public.assets.location_id IS 'Optional reference to a location in the locations table';

