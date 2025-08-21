-- Setup Storage Bucket for Cinema Files
-- Run this in your Supabase SQL Editor

-- Create the cinema_files bucket
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
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the cinema_files bucket

-- Policy: Users can upload files to their own project folders
CREATE POLICY "Users can upload to own project folders" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cinema_files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view files in their own project folders
CREATE POLICY "Users can view own project files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cinema_files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update files in their own project folders
CREATE POLICY "Users can update own project files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'cinema_files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete files in their own project folders
CREATE POLICY "Users can delete own project files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cinema_files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create function to generate file paths
CREATE OR REPLACE FUNCTION generate_file_path(
  user_id UUID,
  project_id UUID,
  file_type TEXT,
  original_name TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN user_id::text || '/' || project_id::text || '/' || file_type || '/' || 
         extract(epoch from now())::bigint || '_' || original_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get file URL
CREATE OR REPLACE FUNCTION get_file_url(file_path TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN 'https://' || current_setting('app.settings.supabase_url') || '/storage/v1/object/public/cinema_files/' || file_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Verify bucket creation
SELECT * FROM storage.buckets WHERE id = 'cinema_files';

-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
