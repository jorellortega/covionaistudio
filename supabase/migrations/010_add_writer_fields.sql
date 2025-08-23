-- Migration: 010_add_writer_fields.sql
-- Description: Add writer and cowriters fields to projects table for movie projects
-- Date: 2024-01-01

-- Add writer and cowriters columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS writer TEXT,
ADD COLUMN IF NOT EXISTS cowriters TEXT[] DEFAULT '{}';

-- Create index for writer queries
CREATE INDEX IF NOT EXISTS idx_projects_writer ON public.projects(writer);
CREATE INDEX IF NOT EXISTS idx_projects_cowriters ON public.projects USING GIN(cowriters);

-- Add comment to explain the cowriters field
COMMENT ON COLUMN public.projects.cowriters IS 'Array of cowriter names for the project';
