-- Rollback: Remove text range fields from storyboards table
DROP VIEW IF EXISTS public.storyboards_view;

-- Remove the check constraint
ALTER TABLE public.storyboards DROP CONSTRAINT IF EXISTS check_text_range_validity;

-- Remove the indexes
DROP INDEX IF EXISTS idx_storyboards_text_start;
DROP INDEX IF EXISTS idx_storyboards_text_end;

-- Remove the columns
ALTER TABLE public.storyboards 
DROP COLUMN IF EXISTS script_text_start,
DROP COLUMN IF EXISTS script_text_snippet,
DROP COLUMN IF EXISTS script_text_end;

-- Recreate the view without the text range fields
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
