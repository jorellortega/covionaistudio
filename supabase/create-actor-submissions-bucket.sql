-- Create actor-submissions storage bucket
-- This bucket stores headshots, videos, resumes, and photos for actor submissions
-- Note: Buckets must be created via Supabase Dashboard or Storage API
-- This script sets up the policies after the bucket is created

-- IMPORTANT: First create the bucket manually in Supabase Dashboard:
-- 1. Go to Storage section
-- 2. Click "New bucket"
-- 3. Name: actor-submissions
-- 4. Set to Public
-- 5. Max file size: 50MB
-- 6. Allowed MIME types: image/*, video/*, application/pdf

-- After creating the bucket, run this script to set up policies

-- Drop existing policies if they exist (idempotent)
-- Using DO block to safely drop any existing policies with similar names
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND (
            policyname LIKE '%submission%' 
            OR policyname = 'Anyone can upload submissions'
            OR policyname = 'Anyone can view submissions'
            OR policyname = 'Owners can delete submissions'
            OR policyname = 'Owners can update submissions'
        )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

-- Allow public uploads (for actors submitting applications)
CREATE POLICY "Anyone can upload submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'actor-submissions');

-- Allow public reads (so actors and owners can view uploaded files)
CREATE POLICY "Anyone can view submissions"
ON storage.objects FOR SELECT
USING (bucket_id = 'actor-submissions');

-- Allow owners to delete submissions (for cleaning up old files)
CREATE POLICY "Owners can delete submissions"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'actor-submissions' 
  AND auth.uid() IN (
    SELECT user_id FROM public.projects 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow owners to update their own submission files (if needed)
CREATE POLICY "Owners can update submissions"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'actor-submissions' 
  AND auth.uid() IN (
    SELECT user_id FROM public.projects 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

