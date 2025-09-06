-- Add status field to storyboards table
-- Run this SQL in your Supabase SQL editor or psql

-- Add status column to storyboards table
ALTER TABLE public.storyboards 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in-progress', 'review', 'approved', 'rejected', 'completed'));

-- Add a comment explaining the status field
COMMENT ON COLUMN public.storyboards.status IS 'Current status of the storyboard shot (draft, in-progress, review, approved, rejected, completed)';

-- Create index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_storyboards_status ON public.storyboards(status);

-- Update existing storyboards to have 'draft' status if they don't have one
UPDATE public.storyboards 
SET status = 'draft' 
WHERE status IS NULL;

-- Update the storyboards_view to include status
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
