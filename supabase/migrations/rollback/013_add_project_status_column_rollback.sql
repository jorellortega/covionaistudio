-- Rollback Migration: 013_add_project_status_column_rollback.sql
-- Description: Remove project_status column from projects table
-- Date: 2024-01-01

-- Drop the index first
DROP INDEX IF EXISTS idx_projects_project_status;

-- Remove the project_status column
ALTER TABLE public.projects DROP COLUMN IF EXISTS project_status;
