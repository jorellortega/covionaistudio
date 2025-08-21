-- Clean up duplicate user profiles
-- Run this in your Supabase SQL Editor

-- First, let's see what we have
SELECT id, email, name, created_at FROM public.users ORDER BY created_at;

-- Check for any duplicate IDs
SELECT id, COUNT(*) as count 
FROM public.users 
GROUP BY id 
HAVING COUNT(*) > 1;

-- If you have duplicates, you can remove them with:
-- DELETE FROM public.users WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at) as rn
--     FROM public.users
--   ) t WHERE t.rn > 1
-- );

-- Verify the cleanup
SELECT id, email, name, created_at FROM public.users ORDER BY created_at;
