-- Migration: 064_add_shared_access_rls_policies.sql
-- Description: Add RLS policies to allow shared users to read projects, timelines, and scenes they have access to
-- Date: 2024-12-XX

-- Create a SECURITY DEFINER function to check if user has access to a project via shares
-- This function bypasses RLS to check project_shares and users tables
CREATE OR REPLACE FUNCTION has_shared_access_to_project(project_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user's email from users table
  SELECT email INTO user_email
  FROM public.users
  WHERE id = user_uuid;
  
  -- Check if user has access via project_shares
  RETURN EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_shares.project_id = project_uuid
    AND project_shares.is_revoked = FALSE
    AND (
      project_shares.shared_with_user_id = user_uuid
      OR (
        project_shares.shared_with_email IS NOT NULL
        AND user_email IS NOT NULL
        AND LOWER(project_shares.shared_with_email) = LOWER(user_email)
      )
    )
    AND (project_shares.deadline IS NULL OR project_shares.deadline > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION has_shared_access_to_project(UUID, UUID) TO authenticated;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Shared users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Shared users can view shared timelines" ON public.timelines;
DROP POLICY IF EXISTS "Shared users can view shared scenes" ON public.scenes;
DROP POLICY IF EXISTS "Shared users can view shared assets" ON public.assets;
DROP POLICY IF EXISTS "Shared users can view shared characters" ON public.characters;
DROP POLICY IF EXISTS "Shared users can view shared locations" ON public.locations;
DROP POLICY IF EXISTS "Shared users can view shared storyboards" ON public.storyboards;
DROP POLICY IF EXISTS "Shared users can view shared treatments" ON public.treatments;

-- Add policy for shared users to view projects they have access to
CREATE POLICY "Shared users can view shared projects" ON public.projects
  FOR SELECT USING (
    has_shared_access_to_project(id, auth.uid())
  );

-- Add policy for shared users to view timelines for projects they have access to
CREATE POLICY "Shared users can view shared timelines" ON public.timelines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timelines.project_id
      AND has_shared_access_to_project(projects.id, auth.uid())
    )
  );

-- Add policy for shared users to view scenes for timelines they have access to
CREATE POLICY "Shared users can view shared scenes" ON public.scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.timelines
      JOIN public.projects ON projects.id = timelines.project_id
      WHERE timelines.id = scenes.timeline_id
      AND has_shared_access_to_project(projects.id, auth.uid())
    )
  );

-- Add policy for shared users to view assets for projects they have access to
CREATE POLICY "Shared users can view shared assets" ON public.assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = assets.project_id
      AND has_shared_access_to_project(projects.id, auth.uid())
    )
  );

-- Add policy for shared users to view characters for projects they have access to
CREATE POLICY "Shared users can view shared characters" ON public.characters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = characters.project_id
      AND has_shared_access_to_project(projects.id, auth.uid())
    )
  );

-- Add policy for shared users to view locations for projects they have access to
CREATE POLICY "Shared users can view shared locations" ON public.locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = locations.project_id
      AND has_shared_access_to_project(projects.id, auth.uid())
    )
  );

-- Add policy for shared users to view storyboards for projects they have access to
CREATE POLICY "Shared users can view shared storyboards" ON public.storyboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = storyboards.project_id
      AND has_shared_access_to_project(projects.id, auth.uid())
    )
  );

-- Add policy for shared users to view treatments for projects they have access to
CREATE POLICY "Shared users can view shared treatments" ON public.treatments
  FOR SELECT USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = treatments.project_id
      AND has_shared_access_to_project(projects.id, auth.uid())
    )
  );

