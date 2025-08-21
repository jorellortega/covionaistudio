-- Rollback for Storyboards Table Migration
-- This script removes the storyboards table and related structures

-- Drop the view first
DROP VIEW IF EXISTS storyboards_view;

-- Drop the trigger
DROP TRIGGER IF EXISTS update_storyboards_updated_at ON public.storyboards;

-- Drop the function
DROP FUNCTION IF EXISTS update_storyboards_updated_at();

-- Drop the table
DROP TABLE IF EXISTS public.storyboards;
