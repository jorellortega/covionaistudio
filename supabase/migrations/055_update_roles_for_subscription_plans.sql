-- Migration 055: Update user roles to match subscription plans
-- This updates the role enum to include subscription plan roles: user, creator, studio, production, ceo

-- First, drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_user_role;

-- Drop policies that depend on the role column before altering it
-- These policies reference users.role, so we need to drop them first
DROP POLICY IF EXISTS "Only CEOs can view system AI config" ON public.system_ai_config;
DROP POLICY IF EXISTS "Only CEOs can insert system AI config" ON public.system_ai_config;
DROP POLICY IF EXISTS "Only CEOs can update system AI config" ON public.system_ai_config;
DROP POLICY IF EXISTS "Only CEOs can delete system AI config" ON public.system_ai_config;
DROP POLICY IF EXISTS "Cinema and CEO can view all users" ON public.users;
DROP POLICY IF EXISTS "Only CEOs can update all users" ON public.users;

-- Drop the old enum type (this will fail if it's still in use, so we'll recreate it)
-- We need to convert existing 'cinema' roles to 'user' first
UPDATE users SET role = 'user' WHERE role::text = 'cinema';

-- Drop and recreate the enum with new values
DROP TYPE IF EXISTS user_role CASCADE;

-- Create new enum with subscription plan roles
CREATE TYPE user_role AS ENUM ('user', 'creator', 'studio', 'production', 'ceo');

-- Drop the default value temporarily
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- Update the role column to use the new enum
-- First convert to text, then to the new enum
ALTER TABLE users ALTER COLUMN role TYPE user_role USING 
  CASE 
    WHEN role::text = 'user' THEN 'user'::user_role
    WHEN role::text = 'ceo' THEN 'ceo'::user_role
    ELSE 'user'::user_role
  END;

-- Set the default value back with explicit cast
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'::user_role;

-- Add constraint to ensure valid roles
ALTER TABLE users ADD CONSTRAINT valid_user_role CHECK (role IN ('user', 'creator', 'studio', 'production', 'ceo'));

-- Update helper functions to work with new roles
CREATE OR REPLACE FUNCTION is_ceo(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id
    AND role = 'ceo'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function to check if user has a paid subscription (any plan except 'user')
CREATE OR REPLACE FUNCTION has_subscription(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id
    AND role IN ('creator', 'studio', 'production', 'ceo')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep the old function name for backward compatibility but update it
CREATE OR REPLACE FUNCTION has_cinema_subscription(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id
    AND role IN ('creator', 'studio', 'production', 'ceo')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user role from subscription
CREATE OR REPLACE FUNCTION get_role_from_subscription(user_id UUID DEFAULT auth.uid())
RETURNS user_role AS $$
DECLARE
  active_subscription RECORD;
BEGIN
  -- Check for active subscription
  SELECT plan_id INTO active_subscription
  FROM subscriptions
  WHERE subscriptions.user_id = user_id
    AND subscriptions.status = 'active'
  ORDER BY subscriptions.created_at DESC
  LIMIT 1;

  -- If no active subscription, return 'user'
  IF NOT FOUND THEN
    RETURN 'user'::user_role;
  END IF;

  -- Map plan_id to role
  CASE active_subscription.plan_id
    WHEN 'creator' THEN RETURN 'creator'::user_role;
    WHEN 'studio' THEN RETURN 'studio'::user_role;
    WHEN 'production' THEN RETURN 'production'::user_role;
    ELSE RETURN 'user'::user_role;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync user role from subscription
CREATE OR REPLACE FUNCTION sync_user_role_from_subscription(user_id UUID)
RETURNS void AS $$
DECLARE
  new_role user_role;
BEGIN
  -- Get role from subscription
  new_role := get_role_from_subscription(user_id);
  
  -- Update user role (but don't change CEO role)
  UPDATE users 
  SET role = new_role
  WHERE id = user_id
    AND role != 'ceo'::user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION is_ceo(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_cinema_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_role(user_role, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_role_from_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_role_from_subscription(UUID) TO authenticated;

-- Update RLS policies to use new subscription-based roles
-- Projects: Users can only see their own projects, paid subscribers/ceo can see all
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_subscription()
  );

-- Timelines: Users can only see their own timelines, paid subscribers/ceo can see all
DROP POLICY IF EXISTS "Users can view own timelines" ON timelines;
CREATE POLICY "Users can view own timelines" ON timelines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_id 
      AND (user_id = auth.uid() OR has_subscription())
    )
  );

-- Scenes: Users can only see their own scenes, paid subscribers/ceo can see all
DROP POLICY IF EXISTS "Users can view own scenes" ON scenes;
CREATE POLICY "Users can view own scenes" ON scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM timelines t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = timeline_id 
      AND (p.user_id = auth.uid() OR has_subscription())
    )
  );

-- Recreate policies that were dropped (now with updated role checks)
-- Cinema and CEO can view all users (updated to use new subscription roles)
CREATE POLICY "Cinema and CEO can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()
      AND role IN ('creator', 'studio', 'production', 'ceo')
    )
  );

-- Only CEOs can update all users
CREATE POLICY "Only CEOs can update all users" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()
      AND role = 'ceo'
    )
  );

-- Recreate system_ai_config policies (only CEO, no admin)
CREATE POLICY "Only CEOs can view system AI config" ON public.system_ai_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND role = 'ceo'
    )
  );

CREATE POLICY "Only CEOs can insert system AI config" ON public.system_ai_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND role = 'ceo'
    )
  );

CREATE POLICY "Only CEOs can update system AI config" ON public.system_ai_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND role = 'ceo'
    )
  );

CREATE POLICY "Only CEOs can delete system AI config" ON public.system_ai_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND role = 'ceo'
    )
  );

-- Update comments to document the new role system
COMMENT ON COLUMN users.role IS 'User role for access control: user (free), creator (Creator plan), studio (Studio plan), production (Production House plan), ceo (admin)';
COMMENT ON FUNCTION is_ceo(UUID) IS 'Check if user has CEO role (admin)';
COMMENT ON FUNCTION has_subscription(UUID) IS 'Check if user has any paid subscription (creator, studio, production) or CEO role';
COMMENT ON FUNCTION has_cinema_subscription(UUID) IS 'Check if user has any paid subscription (backward compatibility)';
COMMENT ON FUNCTION has_role(user_role, UUID) IS 'Check if user has specific role';
COMMENT ON FUNCTION get_role_from_subscription(UUID) IS 'Get user role based on active subscription';
COMMENT ON FUNCTION sync_user_role_from_subscription(UUID) IS 'Sync user role from their active subscription (preserves CEO role)';

