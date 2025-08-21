-- Storyboards Table Migration
-- This migration creates the storyboards table and related structures

-- Create storyboards table
CREATE TABLE IF NOT EXISTS public.storyboards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    scene_number INTEGER NOT NULL DEFAULT 1,
    shot_type VARCHAR(50) NOT NULL DEFAULT 'wide' CHECK (shot_type IN ('wide', 'medium', 'close', 'extreme-close')),
    camera_angle VARCHAR(50) NOT NULL DEFAULT 'eye-level' CHECK (camera_angle IN ('eye-level', 'high-angle', 'low-angle', 'dutch-angle')),
    movement VARCHAR(50) NOT NULL DEFAULT 'static' CHECK (movement IN ('static', 'panning', 'tilting', 'tracking', 'zooming')),
    dialogue TEXT,
    action TEXT,
    visual_notes TEXT,
    image_url TEXT,
    ai_generated BOOLEAN DEFAULT FALSE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storyboards_user_id ON public.storyboards(user_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_project_id ON public.storyboards(project_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_scene_number ON public.storyboards(scene_number);
CREATE INDEX IF NOT EXISTS idx_storyboards_shot_type ON public.storyboards(shot_type);
CREATE INDEX IF NOT EXISTS idx_storyboards_ai_generated ON public.storyboards(ai_generated);
CREATE INDEX IF NOT EXISTS idx_storyboards_created_at ON public.storyboards(created_at);
CREATE INDEX IF NOT EXISTS idx_storyboards_updated_at ON public.storyboards(updated_at);

-- Enable Row Level Security
ALTER TABLE public.storyboards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own storyboards" ON public.storyboards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own storyboards" ON public.storyboards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own storyboards" ON public.storyboards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own storyboards" ON public.storyboards
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_storyboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_storyboards_updated_at
    BEFORE UPDATE ON public.storyboards
    FOR EACH ROW EXECUTE FUNCTION update_storyboards_updated_at();

-- Create a view for easier querying with user information
CREATE OR REPLACE VIEW storyboards_view AS
SELECT 
    s.*,
    COALESCE(u.raw_user_meta_data->>'name', u.email) as user_name,
    p.name as project_name
FROM public.storyboards s
JOIN auth.users u ON s.user_id = u.id
LEFT JOIN public.projects p ON s.project_id = p.id;

-- Grant permissions
GRANT ALL ON public.storyboards TO anon, authenticated;
GRANT SELECT ON storyboards_view TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.storyboards IS 'Storyboards for movie scenes with technical and creative details';
COMMENT ON COLUMN public.storyboards.shot_type IS 'Type of camera shot (wide, medium, close, extreme-close)';
COMMENT ON COLUMN public.storyboards.camera_angle IS 'Camera angle relative to subject (eye-level, high-angle, low-angle, dutch-angle)';
COMMENT ON COLUMN public.storyboards.movement IS 'Camera movement during the shot (static, panning, tilting, tracking, zooming)';
COMMENT ON COLUMN public.storyboards.ai_generated IS 'Whether this storyboard was created with AI assistance';
COMMENT ON COLUMN public.storyboards.project_id IS 'Optional link to a specific project';
COMMENT ON COLUMN public.storyboards.image_url IS 'URL to the storyboard image (AI generated or manually created)';
