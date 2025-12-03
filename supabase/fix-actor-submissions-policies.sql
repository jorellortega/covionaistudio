-- Fix actor-submissions storage bucket policies
-- This script safely recreates policies, dropping any existing ones first
-- Run this if you get "policy already exists" errors

-- Drop ALL existing policies for actor-submissions bucket (in case names differ)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%submission%'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

-- Now create the policies fresh
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

