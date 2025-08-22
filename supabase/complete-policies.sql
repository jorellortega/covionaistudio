-- Complete Supabase Policies for Tables and Storage
-- This file includes both database table policies and storage bucket policies

-- ========================================
-- 1. TABLE POLICIES
-- ========================================

-- Enable RLS on the store table
ALTER TABLE store ENABLE ROW LEVEL SECURITY;

-- Create a simple policy for store table that allows authenticated users to:
-- SELECT (read) their own data
-- INSERT (create) new data
-- UPDATE (modify) their own data  
-- DELETE (remove) their own data
CREATE POLICY "Users can manage their own store data" ON store
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ========================================
-- 2. STORAGE BUCKET POLICIES
-- ========================================

-- Create a storage bucket (if it doesn't exist)
-- Uncomment the line below if you need to create the bucket
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', false);

-- Create a simple policy for storage.objects that allows authenticated users to:
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

-- ========================================
-- 3. VERIFICATION QUERIES
-- ========================================

-- Verify table policies
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
WHERE tablename = 'store';

-- Verify storage policies
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

-- ========================================
-- 4. FOLDER STRUCTURE EXAMPLE
-- ========================================

-- Your storage folder structure should look like this:
-- user-files/
-- ├── [user-id-1]/
-- │   ├── file1.jpg
-- │   ├── file2.pdf
-- │   └── documents/
-- └── [user-id-2]/
--     ├── image.png
--     └── videos/
--         └── clip.mp4

-- The policy automatically extracts the first folder name (user-id) 
-- and matches it against the authenticated user's ID
