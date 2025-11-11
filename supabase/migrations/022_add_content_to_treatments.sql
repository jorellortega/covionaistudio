-- Add prompt field to treatments table for full treatment document
-- This matches the movie_ideas table structure (which uses 'prompt' for full treatment content)
-- synopsis = brief summary, prompt = full treatment document

-- Add the prompt column
ALTER TABLE public.treatments 
ADD COLUMN IF NOT EXISTS prompt TEXT;

-- Create index for full-text search on prompt
CREATE INDEX IF NOT EXISTS idx_treatments_prompt ON public.treatments USING gin(to_tsvector('english', prompt));

-- Add comment for documentation
COMMENT ON COLUMN public.treatments.prompt IS 'Full treatment document content (detailed story, scenes, etc.). This matches the movie_ideas.prompt field. Separate from synopsis which is a brief summary.';

