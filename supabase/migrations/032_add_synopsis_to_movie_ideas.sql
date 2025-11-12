-- Add synopsis column to movie_ideas table
-- This allows ideas to have a synopsis that can be used when converting to treatments

ALTER TABLE movie_ideas 
ADD COLUMN IF NOT EXISTS synopsis TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN movie_ideas.synopsis IS 'Brief synopsis (2-3 paragraphs) of the movie idea, used when converting to treatments';

