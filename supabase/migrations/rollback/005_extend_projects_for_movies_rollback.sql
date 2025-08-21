-- Rollback: 005_extend_projects_for_movies_rollback.sql
-- Description: Remove movie-specific columns from projects table
-- Date: 2024-01-01

-- Remove movie-specific columns from projects table
ALTER TABLE public.projects 
DROP COLUMN IF EXISTS project_type,
DROP COLUMN IF EXISTS genre,
DROP COLUMN IF EXISTS scenes,
DROP COLUMN IF EXISTS duration,
DROP COLUMN IF EXISTS thumbnail,
DROP COLUMN IF EXISTS movie_status;

-- Drop indexes
DROP INDEX IF EXISTS idx_projects_type;
DROP INDEX IF EXISTS idx_projects_movie_status;
DROP INDEX IF EXISTS idx_projects_genre;
