-- Test Storage Access After Fix
-- Run this script to verify that storage is working correctly

-- Check bucket status
SELECT 
  'Bucket Status' as test_type,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'cinema_files';

-- Check storage policies
SELECT 
  'Storage Policies' as test_type,
  policyname,
  permissive,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN 'READ ACCESS'
    WHEN cmd = 'INSERT' THEN 'UPLOAD ACCESS'
    WHEN cmd = 'UPDATE' THEN 'UPDATE ACCESS'
    WHEN cmd = 'DELETE' THEN 'DELETE ACCESS'
    ELSE cmd
  END as operation_type
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%cinema_files%'
ORDER BY cmd, policyname;

-- Check if there are any files in the bucket
SELECT 
  'File Count' as test_type,
  COUNT(*) as total_files,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as files_last_24h
FROM storage.objects 
WHERE bucket_id = 'cinema_files';

-- Show sample files (if any exist)
SELECT 
  'Sample Files' as test_type,
  name,
  bucket_id,
  created_at,
  updated_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'cinema_files' 
ORDER BY created_at DESC
LIMIT 3;

-- Test RLS status
SELECT 
  'RLS Status' as test_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'objects' 
  AND schemaname = 'storage';

-- Check permissions
SELECT 
  'Permissions' as test_type,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'objects' 
  AND table_schema = 'storage'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;
