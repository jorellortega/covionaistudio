-- Fix idea_images table to allow idea_id to be nullable
-- This allows images to exist without being associated with a specific idea

-- Drop the existing NOT NULL constraint
ALTER TABLE idea_images ALTER COLUMN idea_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL values
-- First drop the existing foreign key constraint
ALTER TABLE idea_images DROP CONSTRAINT IF EXISTS idea_images_idea_id_fkey;

-- Recreate the foreign key constraint with proper NULL handling
ALTER TABLE idea_images ADD CONSTRAINT idea_images_idea_id_fkey 
  FOREIGN KEY (idea_id) REFERENCES movie_ideas(id) ON DELETE CASCADE;

-- Add a comment explaining the change
COMMENT ON COLUMN idea_images.idea_id IS 'Optional reference to a movie idea. NULL means the image is not associated with any specific idea.';
