-- Add locked_sections column to lyrics table
ALTER TABLE public.lyrics 
ADD COLUMN IF NOT EXISTS locked_sections JSONB DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.lyrics.locked_sections IS 'Stores locked text sections for highlighting in the writers page. Format: array of objects with id, text, start, end properties.';
