-- Rollback Migration: 004_scenes_table_rollback.sql
-- Description: Rollback scenes table
-- Date: 2024-01-01

-- Drop trigger
DROP TRIGGER IF EXISTS update_scenes_updated_at ON public.scenes;

-- Drop indexes
DROP INDEX IF EXISTS idx_scenes_timeline_id;
DROP INDEX IF EXISTS idx_scenes_user_id;
DROP INDEX IF EXISTS idx_scenes_start_time;
DROP INDEX IF EXISTS idx_scenes_type;
DROP INDEX IF EXISTS idx_scenes_created_at;

-- Drop table
DROP TABLE IF EXISTS public.scenes;
