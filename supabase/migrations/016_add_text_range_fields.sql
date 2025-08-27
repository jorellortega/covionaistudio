-- Migration: 016_add_text_range_fields.sql
-- Description: Add text range fields to storyboards for script highlighting
-- Date: 2024-01-01

-- Add text range fields to storyboards table
ALTER TABLE public.storyboards 
ADD COLUMN IF NOT EXISTS script_text_start INTEGER,
ADD COLUMN IF NOT EXISTS script_text_end INTEGER,
ADD COLUMN IF NOT EXISTS script_text_snippet TEXT;

-- Add comments explaining the new fields
COMMENT ON COLUMN public.storyboards.script_text_start IS 'Character position in script where this shot begins';
COMMENT ON COLUMN public.storyboards.script_text_end IS 'Character position in script where this shot ends';
COMMENT ON COLUMN public.storyboards.script_text_snippet IS 'The actual text snippet from the script for this shot';

-- Create indexes for efficient text range querying
CREATE INDEX IF NOT EXISTS idx_storyboards_text_start ON public.storyboards(script_text_start) WHERE script_text_start IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storyboards_text_end ON public.storyboards(script_text_end) WHERE script_text_end IS NOT NULL;

-- Add a check constraint to ensure text ranges are valid
ALTER TABLE public.storyboards 
ADD CONSTRAINT check_text_range_validity 
CHECK (
    (script_text_start IS NULL AND script_text_end IS NULL AND script_text_snippet IS NULL) OR
    (script_text_start IS NOT NULL AND script_text_end IS NOT NULL AND script_text_snippet IS NOT NULL AND script_text_start < script_text_end)
);

-- Update the storyboards_view to include the new fields
DROP VIEW IF EXISTS public.storyboards_view;

CREATE VIEW public.storyboards_view AS
SELECT 
    s.*,
    COALESCE(u.raw_user_meta_data->>'name', u.email) as user_name,
    p.name as project_name,
    sc.name as scene_name,
    t.name as timeline_name
FROM public.storyboards s
JOIN auth.users u ON s.user_id = u.id
LEFT JOIN public.projects p ON s.project_id = p.id
LEFT JOIN public.scenes sc ON s.scene_id = sc.id
LEFT JOIN public.timelines t ON sc.timeline_id = t.id;

-- Grant permissions on the updated view
GRANT SELECT ON storyboards_view TO anon, authenticated;
