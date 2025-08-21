-- Check and fix RLS policies for Cinema Studio
-- Run this in your Supabase SQL Editor

-- Check current RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'projects', 'timelines', 'scenes');

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'projects', 'timelines', 'scenes')
ORDER BY tablename, policyname;

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all policies to ensure they're correct
-- Users table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects table policies
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Timelines table policies
DROP POLICY IF EXISTS "Users can view own timelines" ON public.timelines;
CREATE POLICY "Users can view own timelines" ON public.timelines
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own timelines" ON public.timelines;
CREATE POLICY "Users can insert own timelines" ON public.timelines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own timelines" ON public.timelines;
CREATE POLICY "Users can update own timelines" ON public.timelines
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own timelines" ON public.timelines;
CREATE POLICY "Users can delete own timelines" ON public.timelines
  FOR DELETE USING (auth.uid() = user_id);

-- Scenes table policies
DROP POLICY IF EXISTS "Users can view own scenes" ON public.scenes;
CREATE POLICY "Users can view own scenes" ON public.scenes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scenes" ON public.scenes;
CREATE POLICY "Users can insert own scenes" ON public.scenes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own scenes" ON public.scenes;
CREATE POLICY "Users can update own scenes" ON public.scenes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scenes" ON public.scenes;
CREATE POLICY "Users can delete own scenes" ON public.scenes
  FOR DELETE USING (auth.uid() = user_id);

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'projects', 'timelines', 'scenes')
ORDER BY tablename, policyname;

-- Test query to verify RLS is working
-- This should return the current user's ID if RLS is working
SELECT auth.uid() as current_user_id;
