-- Simple Storage Bucket Policy for Supabase
-- This policy allows authenticated users to perform CRUD operations on files in their own folder

-- Create a storage bucket (if it doesn't exist)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', false);

-- Enable Row Level Security (RLS) on the storage.objects table
-- Note: RLS is typically already enabled on storage.objects by default

-- Create a simple policy that allows authenticated users to:
-- SELECT (download/view) their own files
-- INSERT (upload) files to their own folder
-- UPDATE (modify metadata) their own files
-- DELETE (remove) their own files
CREATE POLICY "Users can manage their own files" ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'user-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'user-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Alternative: If you want separate policies for each operation:
-- CREATE POLICY "Users can view their own files" ON storage.objects
--     FOR SELECT
--     USING (
--         bucket_id = 'user-files' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- 
-- CREATE POLICY "Users can upload files to their folder" ON storage.objects
--     FOR INSERT
--     WITH CHECK (
--         bucket_id = 'user-files' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- 
-- CREATE POLICY "Users can update their own files" ON storage.objects
--     FOR UPDATE
--     USING (
--         bucket_id = 'user-files' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     )
--     WITH CHECK (
--         bucket_id = 'user-files' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- 
-- CREATE POLICY "Users can delete their own files" ON storage.objects
--     FOR DELETE
--     USING (
--         bucket_id = 'user-files' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );

-- Verify the policy was created
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
WHERE tablename = 'objects' AND schemaname = 'storage';
