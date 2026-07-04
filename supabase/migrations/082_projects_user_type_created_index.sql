-- Migration: 082_projects_user_type_created_index.sql
-- Description: Composite index for fast movie list queries by user
-- Date: 2026-07-04

CREATE INDEX IF NOT EXISTS idx_projects_user_type_created
  ON public.projects (user_id, project_type, created_at DESC);
