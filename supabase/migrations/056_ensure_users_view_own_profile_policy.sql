-- Migration 056: Fix infinite recursion in users table RLS policies
-- The issue is that policies like "Cinema and CEO can view all users" query the users table
-- which causes infinite recursion. We need to fix this by using SECURITY DEFINER functions.

-- First, drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Cinema and CEO can view all users" ON public.users;
DROP POLICY IF EXISTS "Only CEOs can update all users" ON public.users;

-- Use the existing SECURITY DEFINER functions (has_subscription, is_ceo) 
-- which bypass RLS to avoid infinite recursion

-- Now create policies that use these functions instead of direct queries
-- Users can view their own profile (including credits column)
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Cinema and CEO can view all users (using has_subscription function to avoid recursion)
-- has_subscription() is SECURITY DEFINER and checks if user has paid subscription
CREATE POLICY "Cinema and CEO can view all users" ON public.users
  FOR SELECT USING (
    has_subscription() OR is_ceo()
  );

-- Only CEOs can update all users (using is_ceo function to avoid recursion)
CREATE POLICY "Only CEOs can update all users" ON public.users
  FOR UPDATE USING (
    is_ceo()
  );

-- Comments
COMMENT ON POLICY "Users can view own profile" ON public.users IS 'Allows users to view their own profile data including credits';
COMMENT ON POLICY "Users can update own profile" ON public.users IS 'Allows users to update their own profile data';
COMMENT ON POLICY "Users can insert own profile" ON public.users IS 'Allows users to insert their own profile during signup';

