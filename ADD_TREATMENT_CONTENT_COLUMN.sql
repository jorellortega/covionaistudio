-- QUICK FIX: Add prompt column to treatments table (matches movie_ideas.prompt)
-- Run this in Supabase SQL Editor RIGHT NOW to enable treatment pasting

-- Add the prompt column (matches ideas table structure)
ALTER TABLE public.treatments 
ADD COLUMN IF NOT EXISTS prompt TEXT;

-- Create index for full-text search (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_treatments_prompt ON public.treatments USING gin(to_tsvector('english', prompt));

-- Add comment
COMMENT ON COLUMN public.treatments.prompt IS 'Full treatment document content (detailed story, scenes, etc.). This matches movie_ideas.prompt field. Separate from synopsis which is a brief summary.';

-- Verify it was added (you should see the column in the results)
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'treatments' 
AND column_name = 'prompt';

