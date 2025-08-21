-- Migration: 007_assets_table.sql
-- Description: Create assets table for storing generated content with versioning
-- Date: 2024-01-01

-- Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('script', 'image', 'video', 'audio')),
  content TEXT,
  content_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_latest_version BOOLEAN NOT NULL DEFAULT true,
  parent_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  prompt TEXT,
  model TEXT,
  generation_settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON public.assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_scene_id ON public.assets(scene_id);
CREATE INDEX IF NOT EXISTS idx_assets_content_type ON public.assets(content_type);
CREATE INDEX IF NOT EXISTS idx_assets_version ON public.assets(version);
CREATE INDEX IF NOT EXISTS idx_assets_is_latest_version ON public.assets(is_latest_version);
CREATE INDEX IF NOT EXISTS idx_assets_parent_asset_id ON public.assets(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at);

-- Enable Row Level Security
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for assets table
CREATE POLICY "Users can view own assets" ON public.assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets" ON public.assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets" ON public.assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.assets TO anon, authenticated;

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Assets table created successfully!';
  RAISE NOTICE '📊 Table: assets with versioning support';
  RAISE NOTICE '🔒 Row Level Security enabled';
  RAISE NOTICE '📝 You can now save generated content to the database!';
END $$;
