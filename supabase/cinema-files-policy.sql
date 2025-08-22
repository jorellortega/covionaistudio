-- Storage Policy for CINEMA_FILES Bucket
-- This policy allows authenticated users to save and manage their generated images and videos

-- Create a policy for the CINEMA_FILES bucket that allows authenticated users to:
-- SELECT (download/view) their own generated content
-- INSERT (upload) new generated images/videos
-- UPDATE (modify metadata) their own files
-- DELETE (remove) their own files
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

-- Alternative: If you want separate policies for each operation:
-- CREATE POLICY "Users can view their generated content" ON storage.objects
--     FOR SELECT
--     USING (
--         bucket_id = 'CINEMA_FILES' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- 
-- CREATE POLICY "Users can upload generated content" ON storage.objects
--     FOR INSERT
--     WITH CHECK (
--         bucket_id = 'CINEMA_FILES' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- 
-- CREATE POLICY "Users can update their generated content" ON storage.objects
--     FOR UPDATE
--     USING (
--         bucket_id = 'CINEMA_FILES' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     )
--     WITH CHECK (
--         bucket_id = 'CINEMA_FILES' 
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- 
-- CREATE POLICY "Users can delete their generated content" ON storage.objects
--     FOR DELETE
--     USING (
--         bucket_id = 'CINEMA_FILES' 
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

-- ========================================
-- FOLDER STRUCTURE FOR GENERATED CONTENT
-- ========================================

-- Your CINEMA_FILES bucket structure should look like this:
-- CINEMA_FILES/
-- ├── [user-id-1]/
-- │   ├── images/
-- │   │   ├── generated-scene-1.jpg
-- │   │   ├── character-design.png
-- │   │   └── storyboard.jpg
-- │   ├── videos/
-- │   │   ├── scene-clip.mp4
-- │   │   └── trailer.mp4
-- │   └── audio/
-- │       └── background-music.mp3
-- └── [user-id-2]/
--     ├── images/
--     │   └── poster-design.jpg
--     └── videos/
--         └── intro-sequence.mp4

-- ========================================
-- HOW TO USE IN YOUR APP
-- ========================================

-- When saving generated content, use this path structure:
-- const filePath = `${user.id}/${contentType}/${fileName}`;
-- 
-- Examples:
-- - Images: "78ed2283-ef51-4613-90bb-a6d3299837d4/images/generated-scene.jpg"
-- - Videos: "78ed2283-ef51-4613-90bb-a6d3299837d4/videos/scene-clip.mp4"
-- - Audio: "78ed2283-ef51-4613-90bb-a6d3299837d4/audio/background.mp3"
