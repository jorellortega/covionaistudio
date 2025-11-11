-- Migration: 023_add_treatment_id_to_assets.sql
-- Description: Add treatment_id column to assets table for storing treatment-related audio files
-- Date: 2024-01-XX

-- Add treatment_id column to assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS treatment_id UUID REFERENCES public.treatments(id) ON DELETE CASCADE;

-- Create index for better performance when querying by treatment_id
CREATE INDEX IF NOT EXISTS idx_assets_treatment_id ON public.assets(treatment_id);

-- Add comment for documentation
COMMENT ON COLUMN public.assets.treatment_id IS 'Reference to treatment if this asset is associated with a treatment (e.g., audio generated from treatment synopsis or prompt)';

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Added treatment_id column to assets table!';
  RAISE NOTICE '📊 Index created: idx_assets_treatment_id';
  RAISE NOTICE '🔗 Assets can now be associated with treatments!';
END $$;

