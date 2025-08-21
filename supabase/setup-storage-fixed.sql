-- Simple Storage Setup for Cinema Files
-- This creates the bucket and basic policies that should work

-- Create the cinema_files bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('cinema_files', 'cinema_files', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Basic policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Basic policy: Allow authenticated users to view files
CREATE POLICY "Allow authenticated views" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Basic policy: Allow authenticated users to update their files
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Basic policy: Allow authenticated users to delete their files
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
);

-- Note: These are basic policies that allow any authenticated user to access the bucket
-- For production, you might want more restrictive policies based on user ownership

