-- Migration: 013_add_project_status_column.sql
-- Description: Add project_status column to projects table for better project state tracking
-- Date: 2024-01-01

-- Add project_status column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'active' CHECK (project_status IN ('active', 'paused', 'canceled', 'draft', 'completed', 'archived'));

-- Update existing projects to have project_status = 'active' if they don't have it
UPDATE public.projects SET project_status = 'active' WHERE project_status IS NULL;

-- Create index for project_status queries
CREATE INDEX IF NOT EXISTS idx_projects_project_status ON public.projects(project_status);

-- Update the existing status column to be more specific (keeping for backward compatibility)
-- The existing status column will remain as a legacy field
-- New projects should use project_status for lifecycle management
