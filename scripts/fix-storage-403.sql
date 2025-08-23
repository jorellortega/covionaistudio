-- Fix Storage 403 Errors
-- Run this script in your Supabase SQL Editor to fix image loading issues

-- First, drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated views" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own project files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Create a new policy that allows public read access to all files
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cinema_files'
);

-- Create policy for authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to update their files
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to delete their files
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Ensure the bucket is public for read access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'cinema_files';

-- Verify the bucket exists and is public
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
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

-- Test if files can be accessed (this will show current files in the bucket)
SELECT 
  name,
  bucket_id,
  created_at,
  updated_at
FROM storage.objects 
WHERE bucket_id = 'cinema_files' 
LIMIT 5;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
