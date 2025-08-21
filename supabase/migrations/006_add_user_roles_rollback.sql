-- Rollback Migration 006: Remove user roles and revert to previous state

-- Drop the role-based policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Cinema and CEO can view all users" ON users;
DROP POLICY IF EXISTS "Only CEOs can update all users" ON users;

-- Drop the role-based project policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;

-- Drop the role-based timeline policies  
DROP POLICY IF EXISTS "Users can view own timelines" ON timelines;

-- Drop the role-based scene policies
DROP POLICY IF EXISTS "Users can view own scenes" ON scenes;

-- Drop the helper functions
DROP FUNCTION IF EXISTS is_ceo(UUID);
DROP FUNCTION IF EXISTS has_cinema_subscription(UUID);
DROP FUNCTION IF EXISTS has_role(user_role, UUID);

-- Drop the user_role enum type
DROP TYPE IF EXISTS user_role CASCADE;

-- Remove the role column
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- Revert to original simple policies
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can view own timelines" ON timelines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_id 
      AND user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can view own scenes" ON scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM timelines t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = timeline_id 
      AND p.user_id = auth.uid()::text
    )
  );
