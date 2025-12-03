-- Add location_id column to storyboards table
-- This allows storyboards to be associated with specific locations
-- for automatic inclusion of location details in image generation

ALTER TABLE storyboards
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_storyboards_location_id ON storyboards(location_id);

-- Add comment
COMMENT ON COLUMN storyboards.location_id IS 'Optional reference to a location. When set, location details will be automatically included in AI image generation prompts.';

