-- Test inserting a treatment manually to debug the 400 error
-- Run this in your Supabase SQL Editor to see what's happening

-- First, let's check the current user context
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    auth.email() as current_email;

-- Check the treatments table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'treatments' 
ORDER BY ordinal_position;

-- Try to insert a test treatment manually
INSERT INTO public.treatments (
    user_id,
    title,
    genre,
    synopsis,
    cover_image_url,
    target_audience,
    estimated_budget,
    estimated_duration
) VALUES (
    (SELECT auth.uid()), -- Use current user ID
    'Test Treatment',
    'Drama',
    'This is a test treatment to debug the insert issue.',
    '/test-cover.jpg',
    'Test audience',
    '$1M',
    '90 min'
) RETURNING *;

-- Check if the insert worked
SELECT * FROM public.treatments WHERE title = 'Test Treatment';

-- Clean up test data
DELETE FROM public.treatments WHERE title = 'Test Treatment';
