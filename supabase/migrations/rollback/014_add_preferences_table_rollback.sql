-- Rollback Migration: 014_add_preferences_table_rollback.sql
-- Description: Remove preferences table from database
-- Date: 2024-01-01

-- Drop the indexes first
DROP INDEX IF EXISTS idx_user_preferences_key;
DROP INDEX IF EXISTS idx_user_preferences_user_id;

-- Remove the preferences table
DROP TABLE IF EXISTS public.user_preferences;
