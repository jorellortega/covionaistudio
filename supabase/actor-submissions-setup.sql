-- Actor Submissions and Casting Settings Tables
-- This script creates the tables for managing actor casting calls and submissions

-- Create casting settings table (settings for each movie's casting call)
CREATE TABLE IF NOT EXISTS public.casting_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    movie_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Visibility settings (what actors can see)
    show_script BOOLEAN DEFAULT false,
    show_scenes BOOLEAN DEFAULT false,
    show_timeline BOOLEAN DEFAULT false,
    show_storyboard BOOLEAN DEFAULT false,
    
    -- Casting information
    roles_available TEXT[], -- Array of role names
    submission_deadline TIMESTAMP WITH TIME ZONE,
    casting_notes TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one casting setting per movie
    UNIQUE(movie_id)
);

-- Create actor submissions table
CREATE TABLE IF NOT EXISTS public.actor_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    movie_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Actor information
    actor_name VARCHAR(255) NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    actor_phone VARCHAR(50),
    
    -- Role applying for
    role_applying_for VARCHAR(255),
    
    -- Submission details
    cover_letter TEXT,
    experience TEXT,
    
    -- Media files (stored in Supabase storage)
    headshot_url TEXT,
    video_url TEXT,
    resume_url TEXT,
    additional_photos TEXT[], -- Array of additional photo URLs
    
    -- Metadata
    submission_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'shortlisted', 'rejected', 'accepted')),
    notes TEXT, -- Internal notes from casting director
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_casting_settings_movie_id ON public.casting_settings(movie_id);
CREATE INDEX IF NOT EXISTS idx_casting_settings_user_id ON public.casting_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_casting_settings_is_active ON public.casting_settings(is_active);

CREATE INDEX IF NOT EXISTS idx_actor_submissions_movie_id ON public.actor_submissions(movie_id);
CREATE INDEX IF NOT EXISTS idx_actor_submissions_status ON public.actor_submissions(status);
CREATE INDEX IF NOT EXISTS idx_actor_submissions_email ON public.actor_submissions(actor_email);
CREATE INDEX IF NOT EXISTS idx_actor_submissions_created_at ON public.actor_submissions(created_at);

-- Enable Row Level Security
ALTER TABLE public.casting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actor_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for casting_settings (only movie owner can manage)
CREATE POLICY "Users can view own casting settings" ON public.casting_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own casting settings" ON public.casting_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own casting settings" ON public.casting_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own casting settings" ON public.casting_settings
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for actor_submissions
-- Movie owner can view all submissions for their movies
CREATE POLICY "Movie owners can view submissions" ON public.actor_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = actor_submissions.movie_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Anyone can submit (public submissions)
CREATE POLICY "Anyone can submit applications" ON public.actor_submissions
    FOR INSERT WITH CHECK (true);

-- Only movie owner can update submissions (for status/notes)
CREATE POLICY "Movie owners can update submissions" ON public.actor_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = actor_submissions.movie_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Only movie owner can delete submissions
CREATE POLICY "Movie owners can delete submissions" ON public.actor_submissions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = actor_submissions.movie_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_casting_settings_updated_at BEFORE UPDATE ON public.casting_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_actor_submissions_updated_at BEFORE UPDATE ON public.actor_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for actor submissions (headshots, videos, resumes)
-- Run this separately in the Supabase Storage UI or via the API
-- Bucket name: actor-submissions
-- Public: true (so actors can upload)
-- File size limit: 50MB
-- Allowed MIME types: image/*, video/*, application/pdf

