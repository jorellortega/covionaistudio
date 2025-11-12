-- Migration: 034_add_screenplay_scenes.sql
-- Description: Add screenplay_scenes table for storing scenes created from screenplays before adding to timeline
-- Date: 2024-12-XX

-- Create screenplay_scenes table
CREATE TABLE IF NOT EXISTS public.screenplay_scenes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  scene_number TEXT,
  location TEXT,
  characters TEXT[],
  shot_type TEXT,
  mood TEXT,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  content TEXT, -- Full scene content/script
  metadata JSONB DEFAULT '{}',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_screenplay_scenes_project_id ON public.screenplay_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_screenplay_scenes_user_id ON public.screenplay_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_screenplay_scenes_order_index ON public.screenplay_scenes(order_index);
CREATE INDEX IF NOT EXISTS idx_screenplay_scenes_created_at ON public.screenplay_scenes(created_at);

-- Enable RLS
ALTER TABLE public.screenplay_scenes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own screenplay scenes" ON public.screenplay_scenes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own screenplay scenes" ON public.screenplay_scenes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own screenplay scenes" ON public.screenplay_scenes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own screenplay scenes" ON public.screenplay_scenes
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_screenplay_scenes_updated_at
  BEFORE UPDATE ON public.screenplay_scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.screenplay_scenes TO anon, authenticated;

