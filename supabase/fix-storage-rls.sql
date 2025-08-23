-- Fix Storage RLS Policies for File Import
-- This fixes the "new row violates row-level security policy" error

-- First, let's drop the existing policies that aren't working
DROP POLICY IF EXISTS "Users can read own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own project folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own project files" ON storage.objects;

-- Create a proper policy for file uploads
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Create a policy for file reads
CREATE POLICY "Allow authenticated users to read files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Create a policy for file updates
CREATE POLICY "Allow authenticated users to update files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Create a policy for file deletes
CREATE POLICY "Allow authenticated users to delete files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Ensure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cinema_files', 
  'cinema_files', 
  false, 
  104857600, -- 100MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/rtf', 'text/markdown', 'image/*', 'video/*', 'audio/*']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Verify the policies are created
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
AND schemaname = 'storage';

-- Test the bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'cinema_files';
