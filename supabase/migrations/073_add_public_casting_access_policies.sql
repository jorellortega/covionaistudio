-- Migration: 073_add_public_casting_access_policies.sql
-- Description: Add RLS policies to allow public (unauthenticated) users to access casting pages when casting is active
-- Date: 2025-01-XX

-- Create a function to check if casting is active for a project
-- This function can be used by both authenticated and unauthenticated users
CREATE OR REPLACE FUNCTION is_casting_active_for_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.casting_settings
    WHERE casting_settings.movie_id = project_uuid
    AND casting_settings.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to public (anonymous) users
GRANT EXECUTE ON FUNCTION is_casting_active_for_project(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_casting_active_for_project(UUID) TO authenticated;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Public can view projects with active casting" ON public.projects;
DROP POLICY IF EXISTS "Public can view active casting settings" ON public.casting_settings;
DROP POLICY IF EXISTS "Public can view characters shown on casting" ON public.characters;
DROP POLICY IF EXISTS "Public can view treatments for active casting" ON public.treatments;
DROP POLICY IF EXISTS "Public can view timelines for active casting" ON public.timelines;
DROP POLICY IF EXISTS "Public can view scenes for active casting" ON public.scenes;
DROP POLICY IF EXISTS "Public can view storyboards for active casting" ON public.storyboards;

-- Add policy for public users to view projects when casting is active
CREATE POLICY "Public can view projects with active casting" ON public.projects
  FOR SELECT USING (
    is_casting_active_for_project(id)
  );

-- Add policy for public users to view casting settings when casting is active
CREATE POLICY "Public can view active casting settings" ON public.casting_settings
  FOR SELECT USING (
    is_active = TRUE
  );

-- Add policy for public users to view characters that are shown on casting
CREATE POLICY "Public can view characters shown on casting" ON public.characters
  FOR SELECT USING (
    show_on_casting = TRUE
    AND project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = characters.project_id
      AND is_casting_active_for_project(projects.id)
    )
  );

-- Add policy for public users to view treatments when casting is active
CREATE POLICY "Public can view treatments for active casting" ON public.treatments
  FOR SELECT USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = treatments.project_id
      AND is_casting_active_for_project(projects.id)
    )
  );

-- Add policy for public users to view timelines when casting is active
CREATE POLICY "Public can view timelines for active casting" ON public.timelines
  FOR SELECT USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timelines.project_id
      AND is_casting_active_for_project(projects.id)
    )
  );

-- Add policy for public users to view scenes when casting is active
CREATE POLICY "Public can view scenes for active casting" ON public.scenes
  FOR SELECT USING (
    timeline_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.timelines
      JOIN public.projects ON projects.id = timelines.project_id
      WHERE timelines.id = scenes.timeline_id
      AND is_casting_active_for_project(projects.id)
    )
  );

-- Add policy for public users to view storyboards when casting is active
CREATE POLICY "Public can view storyboards for active casting" ON public.storyboards
  FOR SELECT USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = storyboards.project_id
      AND is_casting_active_for_project(projects.id)
    )
  );

-- Add comments
COMMENT ON FUNCTION is_casting_active_for_project(UUID) IS 'Checks if casting is active for a project, allowing public access';
COMMENT ON POLICY "Public can view projects with active casting" ON public.projects IS 'Allows unauthenticated users to view projects when casting is active';
COMMENT ON POLICY "Public can view active casting settings" ON public.casting_settings IS 'Allows unauthenticated users to view casting settings when casting is active';
COMMENT ON POLICY "Public can view characters shown on casting" ON public.characters IS 'Allows unauthenticated users to view characters that are shown on casting pages';
COMMENT ON POLICY "Public can view treatments for active casting" ON public.treatments IS 'Allows unauthenticated users to view treatments when casting is active';
COMMENT ON POLICY "Public can view timelines for active casting" ON public.timelines IS 'Allows unauthenticated users to view timelines when casting is active';
COMMENT ON POLICY "Public can view scenes for active casting" ON public.scenes IS 'Allows unauthenticated users to view scenes when casting is active';
COMMENT ON POLICY "Public can view storyboards for active casting" ON public.storyboards IS 'Allows unauthenticated users to view storyboards when casting is active';
