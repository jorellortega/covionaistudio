-- Fix Storage 500 Error for Image Generation
-- This fixes the "Failed to save image to bucket" error

-- First, let's drop any conflicting uppercase bucket if it exists
DELETE FROM storage.buckets WHERE id = 'CINEMA_FILES';

-- Now ensure we have the correct bucket with consistent lowercase naming
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cinema_files',
  'cinema_files',
  false, -- Private bucket for security
  104857600, -- 100MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    'application/pdf',
    'text/plain'
  ]
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "Users can manage their own generated content" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own project folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own project files" ON storage.objects;

-- Create proper policies for the cinema_files bucket (lowercase)
-- Policy: Users can upload files to their own folders
CREATE POLICY "Users can upload to own folders" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cinema_files' 
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view files in their own folders
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cinema_files' 
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update files in their own folders
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'cinema_files' 
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete files in their own folders
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cinema_files' 
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Verify bucket creation
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'cinema_files';

-- Verify policies
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
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%cinema_files%';

-- Test the folder structure policy
-- This should return the user ID from a path like 'user-id/images/filename'
SELECT 
  'test-user-id' as test_user_id,
  'test-user-id/images/test-image.png' as test_path,
  (storage.foldername('test-user-id/images/test-image.png'))[1] as extracted_user_id;
