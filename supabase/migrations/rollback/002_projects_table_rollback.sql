-- Rollback Migration: 002_projects_table_rollback.sql
-- Description: Rollback projects table
-- Date: 2024-01-01

-- Drop trigger
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;

-- Drop indexes
DROP INDEX IF EXISTS idx_projects_user_id;
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_projects_created_at;

-- Drop table
DROP TABLE IF EXISTS public.projects;
