-- Migration: 072_add_storyboard_videos_table.sql
-- Description: Add table to store multiple videos per storyboard with default video support
-- Date: 2025-01-XX

-- Create storyboard_videos table
CREATE TABLE IF NOT EXISTS public.storyboard_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    storyboard_id UUID NOT NULL REFERENCES public.storyboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    video_name TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    generation_model TEXT, -- e.g., "Kling 2.1 Pro", "Veo 3.1", "Leonardo Motion 2.0"
    generation_prompt TEXT,
    metadata JSONB DEFAULT '{}', -- Store additional info like duration, resolution, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storyboard_videos_storyboard_id ON public.storyboard_videos(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_videos_user_id ON public.storyboard_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_videos_is_default ON public.storyboard_videos(is_default);
CREATE INDEX IF NOT EXISTS idx_storyboard_videos_created_at ON public.storyboard_videos(created_at);

-- Ensure only one default video per storyboard
CREATE UNIQUE INDEX IF NOT EXISTS idx_storyboard_videos_one_default 
ON public.storyboard_videos(storyboard_id) 
WHERE is_default = TRUE;

-- Enable Row Level Security
ALTER TABLE public.storyboard_videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own storyboard videos" ON public.storyboard_videos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own storyboard videos" ON public.storyboard_videos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own storyboard videos" ON public.storyboard_videos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own storyboard videos" ON public.storyboard_videos
    FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically unset other defaults when setting a new default
CREATE OR REPLACE FUNCTION public.unset_other_default_videos()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE public.storyboard_videos
        SET is_default = FALSE
        WHERE storyboard_id = NEW.storyboard_id
        AND id != NEW.id
        AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically unset other defaults
CREATE TRIGGER trigger_unset_other_default_videos
    BEFORE INSERT OR UPDATE ON public.storyboard_videos
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION public.unset_other_default_videos();

-- Add comments
COMMENT ON TABLE public.storyboard_videos IS 'Stores multiple videos per storyboard with default video support';
COMMENT ON COLUMN public.storyboard_videos.is_default IS 'Indicates if this is the default video to display for the storyboard';
COMMENT ON COLUMN public.storyboard_videos.generation_model IS 'The AI model used to generate this video';
COMMENT ON COLUMN public.storyboard_videos.metadata IS 'Additional metadata about the video (duration, resolution, etc.)';

