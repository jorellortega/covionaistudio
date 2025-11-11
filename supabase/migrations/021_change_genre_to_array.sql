-- Migration: 021_change_genre_to_array.sql
-- Description: Change genre column from TEXT to JSONB array to support multiple genres
-- Date: 2025-01-XX

-- Step 1: Add new genres column as JSONB array
ALTER TABLE public.movie_ideas 
ADD COLUMN IF NOT EXISTS genres JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing genre data to genres array
-- Convert single genre to array format
UPDATE public.movie_ideas 
SET genres = CASE 
  WHEN genre IS NOT NULL AND genre != '' THEN jsonb_build_array(genre)
  ELSE '[]'::jsonb
END
WHERE genres IS NULL OR genres = '[]'::jsonb;

-- Step 3: Create GIN index on genres for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_movie_ideas_genres ON public.movie_ideas USING GIN (genres);

-- Step 4: Drop the old genre column (optional - we can keep it for backward compatibility temporarily)
-- Uncomment the line below after verifying the migration works correctly
-- ALTER TABLE public.movie_ideas DROP COLUMN IF EXISTS genre;

-- Step 5: Add comment to explain the column
COMMENT ON COLUMN public.movie_ideas.genres IS 'Array of genres (JSONB). Example: ["Fantasy", "Adventure"]. Replaces the single genre TEXT field.';

-- Note: The old 'genre' column is kept for backward compatibility.
-- After verifying the migration works, you can drop it with:
-- ALTER TABLE public.movie_ideas DROP COLUMN IF EXISTS genre;

