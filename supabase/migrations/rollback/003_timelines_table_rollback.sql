-- Rollback Migration: 003_timelines_table_rollback.sql
-- Description: Rollback timelines table
-- Date: 2024-01-01

-- Drop trigger
DROP TRIGGER IF EXISTS update_timelines_updated_at ON public.timelines;

-- Drop indexes
DROP INDEX IF EXISTS idx_timelines_project_id;
DROP INDEX IF EXISTS idx_timelines_user_id;
DROP INDEX IF EXISTS idx_timelines_created_at;

-- Drop table
DROP TABLE IF EXISTS public.timelines;
