-- Migration: 017_add_sequence_order_for_safe_reordering.sql
-- Description: Add sequence_order field for safe shot reordering
-- Date: 2024-01-01

-- Add sequence_order field for flexible shot ordering
ALTER TABLE public.storyboards 
ADD COLUMN IF NOT EXISTS sequence_order DECIMAL(10,2) DEFAULT 1.0;

-- Add comment explaining the new field
COMMENT ON COLUMN public.storyboards.sequence_order IS 'Flexible ordering field that allows inserting shots between existing ones (1.0, 1.5, 2.0, 2.5, 3.0, etc.)';

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_storyboards_sequence_order ON public.storyboards(sequence_order);

-- Update existing storyboards to have proper sequence_order
-- This ensures existing shots have clean integer values
UPDATE public.storyboards 
SET sequence_order = shot_number::DECIMAL(10,2)
WHERE sequence_order IS NULL OR sequence_order = 1.0;

-- Add a unique constraint for scene_id + sequence_order
-- This ensures shots within a scene have unique ordering
-- Note: This constraint might already exist from a previous migration
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_scene_sequence_order' 
        AND table_name = 'storyboards'
    ) THEN
        ALTER TABLE public.storyboards 
        ADD CONSTRAINT unique_scene_sequence_order UNIQUE (scene_id, sequence_order);
    END IF;
END $$;

-- Update the storyboards_view to include the new field
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
