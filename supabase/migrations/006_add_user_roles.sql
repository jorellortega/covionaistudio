-- Migration 006: Add user roles for subscription-based access control
-- This adds a role column to users table and sets up role-based permissions

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user' NOT NULL;

-- Create enum for user roles (subscription-based)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'cinema', 'ceo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update the role column to use the enum
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;

-- Set default role for existing users
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Add constraint to ensure valid roles
ALTER TABLE users ADD CONSTRAINT valid_user_role CHECK (role IN ('user', 'cinema', 'ceo'));

-- Grant role-based permissions
-- Users can only see their own data
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id);

-- Users can update their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Cinema users and CEOs can view all users
CREATE POLICY IF NOT EXISTS "Cinema and CEO can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('cinema', 'ceo')
    )
  );

-- Only CEOs can update all users
CREATE POLICY IF NOT EXISTS "Only CEOs can update all users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role = 'ceo'
    )
  );

-- Create function to check if user is CEO
CREATE OR REPLACE FUNCTION is_ceo(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id::text 
    AND role = 'ceo'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has cinema subscription
CREATE OR REPLACE FUNCTION has_cinema_subscription(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id::text 
    AND role IN ('cinema', 'ceo')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id::text 
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION is_ceo(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_cinema_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_role(user_role, UUID) TO authenticated;

-- Update RLS policies to use role-based access
-- Projects: Users can only see their own projects, cinema/ceo can see all
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (
    user_id = auth.uid()::text 
    OR has_cinema_subscription()
  );

-- Timelines: Users can only see their own timelines, cinema/ceo can see all
DROP POLICY IF EXISTS "Users can view own timelines" ON timelines;
CREATE POLICY "Users can view own timelines" ON timelines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_id 
      AND (user_id = auth.uid()::text OR has_cinema_subscription())
    )
  );

-- Scenes: Users can only see their own scenes, cinema/ceo can see all
DROP POLICY IF EXISTS "Users can view own scenes" ON scenes;
CREATE POLICY "Users can view own scenes" ON scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM timelines t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = timeline_id 
      AND (p.user_id = auth.uid()::text OR has_cinema_subscription())
    )
  );

-- Add comment to document the role system
COMMENT ON COLUMN users.role IS 'User role for access control: user (free), cinema (subscription), ceo (admin)';
COMMENT ON FUNCTION is_ceo(UUID) IS 'Check if user has CEO role (admin)';
COMMENT ON FUNCTION has_cinema_subscription(UUID) IS 'Check if user has cinema subscription or CEO role';
COMMENT ON FUNCTION has_role(user_role, UUID) IS 'Check if user has specific role';
