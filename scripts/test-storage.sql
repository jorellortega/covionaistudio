-- Test Storage Setup
-- Run this after setting up the storage bucket to verify everything works

-- 1. Check if the bucket exists
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'cinema_files';

-- 2. Check if RLS is enabled on storage.objects
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';

-- 3. Check if policies are created
SELECT 
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;

-- 4. Test file path parsing (this should work)
SELECT 
  '78ed2283-ef51-4613-90bb-a6d3299837d4/60761e6c-19c4-4edc-9918-45d0d3f651db/image/test.png' as file_path,
  (string_to_array('78ed2283-ef51-4613-90bb-a6d3299837d4/60761e6c-19c4-4edc-9918-45d0d3f651db/image/test.png', '/'))[1] as user_id,
  (string_to_array('78ed2283-ef51-4613-90bb-a6d3299837d4/60761e6c-19c4-4edc-9918-45d0d3f651db/image/test.png', '/'))[2] as project_id,
  (string_to_array('78ed2283-ef51-4613-90bb-a6d3299837d4/60761e6c-19c4-4edc-9918-45d0d3f651db/image/test.png', '/'))[3] as file_type;

-- 5. Test if current user can be authenticated
SELECT auth.uid() as current_user_id;

-- 6. Check storage permissions
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'objects' 
  AND table_schema = 'storage'
  AND grantee = 'authenticated';
