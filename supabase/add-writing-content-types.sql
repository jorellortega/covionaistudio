-- Migration: Add writing content types to assets table
-- Description: Extend assets table to support lyrics, poetry, and prose content types
-- Date: 2024-12-20

-- First, let's check the current constraint
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.assets'::regclass 
AND contype = 'c';

-- Drop the existing content_type constraint
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_content_type_check;

-- Add the new constraint with expanded content types
ALTER TABLE public.assets ADD CONSTRAINT assets_content_type_check 
CHECK (content_type IN ('script', 'image', 'video', 'audio', 'lyrics', 'poetry', 'prose'));

-- Update the comment on the content_type column
COMMENT ON COLUMN public.assets.content_type IS 'Type of content: script, image, video, audio, lyrics, poetry, or prose';

-- Create additional indexes for better performance on writing content types
CREATE INDEX IF NOT EXISTS idx_assets_writing_content ON public.assets(content_type) 
WHERE content_type IN ('lyrics', 'poetry', 'prose');

CREATE INDEX IF NOT EXISTS idx_assets_writing_user ON public.assets(user_id, content_type) 
WHERE content_type IN ('lyrics', 'poetry', 'prose');

-- Add a function to help with writing content statistics
CREATE OR REPLACE FUNCTION get_user_writing_stats(user_uuid UUID)
RETURNS TABLE(
  content_type TEXT,
  count BIGINT,
  total_versions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.content_type,
    COUNT(DISTINCT a.id) as count,
    COUNT(a.id) as total_versions
  FROM public.assets a
  WHERE a.user_id = user_uuid 
    AND a.content_type IN ('lyrics', 'poetry', 'prose', 'script')
  GROUP BY a.content_type
  ORDER BY a.content_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_writing_stats(UUID) TO authenticated;

-- Create a view for easy access to writing content
CREATE OR REPLACE VIEW writing_content_view AS
SELECT 
  a.id,
  a.user_id,
  a.project_id,
  a.scene_id,
  a.title,
  a.content_type,
  a.content,
  a.version,
  a.version_name,
  a.is_latest_version,
  a.parent_asset_id,
  a.prompt,
  a.model,
  a.metadata,
  a.created_at,
  a.updated_at,
  -- Add computed fields for writing content
  CASE 
    WHEN a.content_type IN ('lyrics', 'poetry', 'prose') THEN true
    ELSE false
  END as is_writing_content,
  -- Extract tags from metadata if they exist
  COALESCE(a.metadata->>'tags', '[]') as tags,
  -- Extract description from metadata if it exists
  COALESCE(a.metadata->>'description', '') as description
FROM public.assets a
WHERE a.content_type IN ('lyrics', 'poetry', 'prose', 'script');

-- Grant select permission on the view
GRANT SELECT ON writing_content_view TO authenticated;

-- Create RLS policy for the view
CREATE POLICY "Users can view own writing content" ON writing_content_view
  FOR SELECT USING (auth.uid() = user_id);

-- Add some helpful comments
COMMENT ON TABLE public.assets IS 'Stores all user content including scripts, images, videos, audio, lyrics, poetry, and prose with versioning support';
COMMENT ON COLUMN public.assets.metadata IS 'JSON metadata including tags, description, and content-specific information for writing content';

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Writing content types added to assets table!';
  RAISE NOTICE '📝 New content types: lyrics, poetry, prose';
  RAISE NOTICE '🔍 New indexes created for better performance';
  RAISE NOTICE '📊 Writing content view created for easy access';
  RAISE NOTICE '📈 Stats function created for content analytics';
  RAISE NOTICE '🎯 You can now store lyrics, poetry, and prose in the assets table!';
END $$;
