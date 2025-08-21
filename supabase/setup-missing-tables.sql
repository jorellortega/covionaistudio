-- Setup Missing Tables for Cinema Studio
-- Run this in your Supabase SQL Editor if you're getting 406 errors

-- Create scenes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  timeline_id UUID REFERENCES public.timelines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_time_seconds INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  scene_type TEXT DEFAULT 'video' CHECK (scene_type IN ('video', 'image', 'text', 'audio')),
  content_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for scenes table
CREATE INDEX IF NOT EXISTS idx_scenes_timeline_id ON public.scenes(timeline_id);
CREATE INDEX IF NOT EXISTS idx_scenes_user_id ON public.scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_start_time ON public.scenes(start_time_seconds);
CREATE INDEX IF NOT EXISTS idx_scenes_type ON public.scenes(scene_type);
CREATE INDEX IF NOT EXISTS idx_scenes_created_at ON public.scenes(created_at);

-- Enable RLS on scenes table
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for scenes table
DROP POLICY IF EXISTS "Users can view own scenes" ON public.scenes;
CREATE POLICY "Users can view own scenes" ON public.scenes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scenes" ON public.scenes;
CREATE POLICY "Users can insert own scenes" ON public.scenes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own scenes" ON public.scenes;
CREATE POLICY "Users can update own scenes" ON public.scenes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scenes" ON public.scenes;
CREATE POLICY "Users can delete own scenes" ON public.scenes
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at on scenes table
DROP TRIGGER IF EXISTS update_scenes_updated_at ON public.scenes;
CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions on scenes table
GRANT ALL ON public.scenes TO anon, authenticated;

-- Verify tables exist
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'projects', 'timelines', 'scenes')
ORDER BY tablename;

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Missing tables setup completed!';
  RAISE NOTICE '📊 Scenes table created with RLS policies';
  RAISE NOTICE '🔒 Row Level Security enabled';
  RAISE NOTICE '📝 You can now create and view scenes!';
END $$;
