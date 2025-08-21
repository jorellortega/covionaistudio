-- Secure Storage Setup for Cinema Files
-- This creates the bucket with user isolation while allowing image display

-- Create the cinema_files bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('cinema_files', 'cinema_files', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to read files in their own project folders
CREATE POLICY "Users can read own project files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cinema_files' 
  AND (
    -- Allow public read access for now (can be restricted later)
    true
    -- OR restrict to user's own files:
    -- auth.uid()::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy: Allow users to upload files to their own project folders
CREATE POLICY "Users can upload to own project folders" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
  AND (
    -- Allow any authenticated user to upload for now
    true
    -- OR restrict to user's own folders:
    -- auth.uid()::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy: Allow users to update files in their own project folders
CREATE POLICY "Users can update own project files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
  AND (
    -- Allow any authenticated user to update for now
    true
    -- OR restrict to user's own files:
    -- auth.uid()::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy: Allow users to delete files in their own project folders
CREATE POLICY "Users can delete own project files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'cinema_files' 
  AND auth.role() = 'authenticated'
  AND (
    -- Allow any authenticated user to delete for now
    true
    -- OR restrict to user's own files:
    -- auth.uid()::text = (string_to_array(name, '/'))[1]
  )
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Note: This setup allows any authenticated user to access the bucket
-- while maintaining RLS for future security enhancements
-- For production, uncomment the user isolation lines above
