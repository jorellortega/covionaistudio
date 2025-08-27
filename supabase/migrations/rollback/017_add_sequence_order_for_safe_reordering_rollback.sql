-- Rollback: Remove sequence_order field from storyboards table
DROP VIEW IF EXISTS public.storyboards_view;

-- Remove the unique constraint
ALTER TABLE public.storyboards DROP CONSTRAINT IF EXISTS unique_scene_sequence_order;

-- Remove the index
DROP INDEX IF EXISTS idx_storyboards_sequence_order;

-- Remove the column
ALTER TABLE public.storyboards DROP COLUMN IF EXISTS sequence_order;

-- Recreate the view without the sequence_order field
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
