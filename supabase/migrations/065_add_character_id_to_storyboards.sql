-- Add character_id column to storyboards table
-- This allows storyboards to be associated with specific characters
-- for automatic inclusion of character details in image generation

ALTER TABLE storyboards
ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_storyboards_character_id ON storyboards(character_id);

-- Add comment
COMMENT ON COLUMN storyboards.character_id IS 'Optional reference to a character. When set, character details will be automatically included in AI image generation prompts.';

