-- Create the CINEMA_FILES storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'CINEMA_FILES',
  'CINEMA_FILES',
  true,
  52428800, -- 50MB file size limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own files
CREATE POLICY "Users can manage their own generated content" ON storage.objects
FOR ALL
USING (
    bucket_id = 'CINEMA_FILES' 
    AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'CINEMA_FILES' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'CINEMA_FILES';

-- Show existing buckets (for reference)
SELECT id, name, public, file_size_limit FROM storage.buckets;
