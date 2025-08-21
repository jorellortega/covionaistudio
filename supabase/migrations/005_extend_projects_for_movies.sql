-- Migration: 005_extend_projects_for_movies.sql
-- Description: Extend projects table to support movie projects
-- Date: 2024-01-01

-- Add movie-specific columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'general' CHECK (project_type IN ('general', 'movie', 'video', 'animation')),
ADD COLUMN IF NOT EXISTS genre TEXT,
ADD COLUMN IF NOT EXISTS scenes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration TEXT,
ADD COLUMN IF NOT EXISTS thumbnail TEXT,
ADD COLUMN IF NOT EXISTS movie_status TEXT DEFAULT 'Pre-Production' CHECK (movie_status IN ('Pre-Production', 'Production', 'Post-Production', 'Distribution'));

-- Update existing projects to have type 'general'
UPDATE public.projects SET project_type = 'general' WHERE project_type IS NULL;

-- Create index for movie-specific queries
CREATE INDEX IF NOT EXISTS idx_projects_type ON public.projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_movie_status ON public.projects(movie_status);
CREATE INDEX IF NOT EXISTS idx_projects_genre ON public.projects(genre);
