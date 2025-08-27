-- Add creator fields to movie_ideas table
-- Main creator is a single text field for the primary creator
-- Co-creators is a JSONB array to store multiple co-creators

-- Add main_creator field (single creator, required)
ALTER TABLE movie_ideas 
ADD COLUMN main_creator TEXT NOT NULL DEFAULT 'Unknown';

-- Add co_creators field (array of co-creators, optional)
ALTER TABLE movie_ideas 
ADD COLUMN co_creators JSONB DEFAULT '[]'::jsonb;

-- Create index on main_creator for better search performance
CREATE INDEX IF NOT EXISTS idx_movie_ideas_main_creator ON movie_ideas(main_creator);

-- Create GIN index on co_creators for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_movie_ideas_co_creators ON movie_ideas USING GIN (co_creators);

-- Update existing records to have a default main_creator
UPDATE movie_ideas 
SET main_creator = 'Unknown' 
WHERE main_creator IS NULL;

-- Add constraint to ensure main_creator is not empty
ALTER TABLE movie_ideas 
ADD CONSTRAINT check_main_creator_not_empty 
CHECK (main_creator != '' AND main_creator IS NOT NULL);

-- Example of how co_creators JSONB will look:
-- ["John Doe", "Jane Smith", "Bob Johnson"]
-- This allows for flexible storage of multiple co-creators
