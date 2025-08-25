-- Migration: 012_link_storyboards_to_scenes.sql
-- Description: Link storyboards to scenes instead of projects for proper hierarchy
-- Date: 2024-01-01

-- First, add the scene_id column to storyboards
ALTER TABLE public.storyboards 
ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE;

-- Add a comment explaining the new relationship
COMMENT ON COLUMN public.storyboards.scene_id IS 'Reference to the scene this storyboard belongs to';

-- Create index for efficient querying by scene
CREATE INDEX IF NOT EXISTS idx_storyboards_scene_id ON public.storyboards(scene_id);

-- Update the unique constraint to include scene_id instead of just scene_number + shot_number
-- This allows multiple scenes to have the same scene_number + shot_number combination
ALTER TABLE public.storyboards DROP CONSTRAINT IF EXISTS unique_scene_shot;

-- Add new unique constraint for scene_id + shot_number
ALTER TABLE public.storyboards 
ADD CONSTRAINT unique_scene_shot_number UNIQUE (scene_id, shot_number);

-- Drop the existing view first to avoid column name conflicts
DROP VIEW IF EXISTS public.storyboards_view;

-- Create the new storyboards_view with scene information
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

-- Add comment explaining the new structure
COMMENT ON TABLE public.storyboards IS 'Storyboards for movie scenes with technical and creative details - now properly linked to scenes';
COMMENT ON COLUMN public.storyboards.scene_id IS 'Reference to the scene this storyboard belongs to (creates movie-scene-storyboard hierarchy)';
