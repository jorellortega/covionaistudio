-- Fix Storage 403 Errors
-- Run this script in your Supabase SQL Editor to fix image loading issues

-- First, drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated views" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own project files" ON storage.objects;

-- Create a new policy that allows public read access
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cinema_files'
);

-- Verify the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'cinema_files';

-- Check current policies
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;

-- Test if a file can be accessed (replace with an actual file path from your bucket)
-- SELECT * FROM storage.objects WHERE bucket_id = 'cinema_files' LIMIT 1;
