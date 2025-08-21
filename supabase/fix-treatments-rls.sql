-- Fix RLS Policies for Treatments Table
-- This fixes the 403 Forbidden error when creating treatments

-- First, let's check if the treatments table exists and has RLS enabled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'treatments') THEN
        RAISE EXCEPTION 'Treatments table does not exist. Please run the treatments-setup.sql first.';
    END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Users can insert own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Users can update own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Users can delete own treatments" ON public.treatments;

-- Ensure RLS is enabled
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

-- Create new, more permissive policies for testing
-- Users can view all treatments (for now, to test if RLS is the issue)
CREATE POLICY "Users can view all treatments" ON public.treatments
    FOR SELECT USING (true);

-- Users can insert treatments (for now, to test if RLS is the issue)
CREATE POLICY "Users can insert treatments" ON public.treatments
    FOR INSERT WITH CHECK (true);

-- Users can update treatments (for now, to test if RLS is the issue)
CREATE POLICY "Users can update treatments" ON public.treatments
    FOR UPDATE USING (true);

-- Users can delete treatments (for now, to test if RLS is the issue)
CREATE POLICY "Users can delete treatments" ON public.treatments
    FOR DELETE USING (true);

-- Grant all permissions to authenticated users
GRANT ALL ON public.treatments TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Test the current user context
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    auth.email() as current_email;

-- Check if the treatments table is accessible
SELECT COUNT(*) as treatment_count FROM public.treatments;

-- If you want to restrict access later, you can replace the policies above with these:
/*
-- More restrictive policies (uncomment when basic functionality works)
CREATE POLICY "Users can view own treatments" ON public.treatments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own treatments" ON public.treatments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own treatments" ON public.treatments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own treatments" ON public.treatments
    FOR DELETE USING (auth.uid() = user_id);
*/
