-- Quick Storage RLS Fix for File Import
-- Run this in your Supabase SQL Editor to fix the upload issue

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own project folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own project files" ON storage.objects;

-- Create simple, working policies
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Ensure bucket exists with proper settings
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cinema_files', 'cinema_files', false, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
