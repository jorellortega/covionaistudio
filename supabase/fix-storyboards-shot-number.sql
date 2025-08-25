-- Fix storyboards shot_number field
-- This script ensures all existing storyboards have proper shot_number values

-- First, let's check if the shot_number column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'storyboards' AND column_name = 'shot_number'
    ) THEN
        -- Add the shot_number column if it doesn't exist
        ALTER TABLE public.storyboards 
        ADD COLUMN shot_number INTEGER NOT NULL DEFAULT 1;
        
        -- Add a comment explaining the column
        COMMENT ON COLUMN public.storyboards.shot_number IS 'Sequential shot number within a scene (1, 2, 3, etc.)';
        
        -- Create a composite index for efficient querying by scene and shot
        CREATE INDEX IF NOT EXISTS idx_storyboards_scene_shot ON public.storyboards(scene_number, shot_number);
        
        -- Add a unique constraint to prevent duplicate shot numbers within the same scene
        ALTER TABLE public.storyboards 
        ADD CONSTRAINT unique_scene_shot UNIQUE (scene_number, shot_number);
    END IF;
END $$;

-- Update existing storyboards to have sequential shot numbers
-- This ensures existing data has proper shot numbering
WITH numbered_shots AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY scene_number ORDER BY created_at) as new_shot_number
  FROM public.storyboards
  WHERE shot_number IS NULL OR shot_number = 0
)
UPDATE public.storyboards 
SET shot_number = numbered_shots.new_shot_number
FROM numbered_shots
WHERE storyboards.id = numbered_shots.id;

-- Set shot_number to 1 for any remaining NULL values
UPDATE public.storyboards 
SET shot_number = 1 
WHERE shot_number IS NULL OR shot_number = 0;

-- Update the storyboards_view to include shot_number
CREATE OR REPLACE VIEW storyboards_view AS
SELECT 
    s.*,
    COALESCE(u.raw_user_meta_data->>'name', u.email) as user_name,
    p.name as project_name
FROM public.storyboards s
JOIN auth.users u ON s.user_id = u.id
LEFT JOIN public.projects p ON s.project_id = p.id;

-- Grant permissions on the updated view
GRANT SELECT ON storyboards_view TO anon, authenticated;

-- Verify the fix
SELECT 
    id, 
    title, 
    scene_number, 
    shot_number, 
    created_at 
FROM public.storyboards 
ORDER BY scene_number, shot_number 
LIMIT 10;
